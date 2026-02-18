import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  StatusBar,
  Linking,
  Modal,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/lib/useColorScheme';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import DiscoveryProfileView from '@/components/matching/DiscoveryProfileView';

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
  photo_verified?: boolean;
  photos?: { url: string; is_primary?: boolean; display_order?: number; caption?: string }[];
  prompt_answers?: { prompt: string; answer: string }[];
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
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
            display_order,
            blur_data_uri
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116 = no rows), redirect to onboarding
        if (error.code === 'PGRST116') {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingRight: rightSafeArea }]}>
      <StatusBar barStyle={isDarkColorScheme ? "light-content" : "dark-content"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Avatar Section */}
        <View style={[styles.avatarSection, { paddingTop: insets.top + 32 }]}>
          {profile?.photos && profile.photos.length > 0 ? (
            <Image
              source={{ uri: (profile.photos.find(p => p.is_primary) || profile.photos[0])?.url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {profile?.display_name}
          </Text>
          <View style={styles.verifiedRow}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={20}
              color={(profile?.photo_verified || profile?.is_verified) ? '#A08AB7' : colors.mutedForeground}
            />
            <Text style={(profile?.photo_verified || profile?.is_verified) ? styles.verifiedText : [styles.unverifiedText, { color: colors.mutedForeground }]}>
              {(profile?.photo_verified || profile?.is_verified) ? t('profile.verified') : t('profile.notVerified')}
            </Text>
          </View>
        </View>

        {/* Profile Content */}
        <View style={styles.content}>
          {/* Edit Profile Button */}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/settings/edit-profile')}
          >
            <MaterialCommunityIcons name="pencil" size={20} color="white" />
            <Text style={styles.editProfileText}>{t('profile.editYourProfile')}</Text>
          </TouchableOpacity>

          {/* Preview Profile Button */}
          <TouchableOpacity
            style={styles.previewProfileButton}
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

          {/* ===== ACTIVITY & MATCHING ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Activity & Matching</Text>

            {/* Matching Preferences */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/matching-preferences')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="heart-cog" size={24} color="#A08AB7" />
                <Text style={[styles.menuItemText, { color: '#A08AB7', fontWeight: '600' }]}>{t('profile.matchingPreferences')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
            </TouchableOpacity>
          </View>

          {/* ===== APP SETTINGS ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Settings</Text>

            {/* Account & Privacy */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/privacy')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="cog-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.settingsPrivacy')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/notifications')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="bell-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.notifications')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/language')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="translate" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.language')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Appearance */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/appearance')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="theme-light-dark" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.appearance')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>
          </View>

          {/* ===== REVIEWS ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Reviews</Text>

            {/* My Reviews */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/reviews/my-reviews')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="star-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.myReviews')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Review Settings */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/review-settings')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="star-settings-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.reviewSettings')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>
          </View>

          {/* ===== SAFETY & PRIVACY ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Safety & Privacy</Text>

            {/* Safety Center */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/safety-center')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.safetyCenter')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Photo Verification */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/privacy')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="camera-account" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.photoVerification')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Blocked Users */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/blocked-users')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="account-cancel-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockedUsers')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Block Contacts */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/contact-blocking')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="phone-off" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockContacts')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>

            {/* Block Countries */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/settings/country-blocking')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="earth-off" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockCountries')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>
          </View>

          {/* ===== SUBSCRIPTION ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Subscription</Text>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: !isPremium ? '#F5F0FF' : colors.card, borderColor: !isPremium ? '#A08AB7' : colors.border, borderLeftWidth: !isPremium ? 4 : 0, borderLeftColor: '#A08AB7' }]}
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
          </View>

          {/* ===== SUPPORT ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>Support</Text>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={async () => {
                try {
                  const mailtoUrl = 'mailto:hello@joinaccord.app?subject=Support Request&body=Hi Accord Team,\n\n';
                  const canOpen = await Linking.canOpenURL(mailtoUrl);
                  if (canOpen) {
                    await Linking.openURL(mailtoUrl);
                  } else {
                    Alert.alert(
                      'Contact Support',
                      'Email us at hello@joinaccord.app',
                      [{ text: 'OK' }]
                    );
                  }
                } catch (error) {
                  Alert.alert(
                    'Contact Support',
                    'Email us at hello@joinaccord.app',
                    [{ text: 'OK' }]
                  );
                }
              }}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.helpSupport')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
            </TouchableOpacity>
          </View>

          {/* ===== ADMIN PANEL ===== */}
          {isAdmin && (
            <View style={styles.menuSection}>
              <Text style={[styles.menuSectionTitle, { color: '#F59E0B' }]}>Admin Tools</Text>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}
                onPress={() => router.push('/admin/reports')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="shield-alert" size={24} color="#F59E0B" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#92400E', fontWeight: '700' }]}>{t('profile.adminPanel')}</Text>
                    <Text style={styles.adminSubtext}>{t('profile.viewReports')}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#F59E0B" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}
                onPress={() => router.push('/admin/cost-monitoring')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="chart-line" size={24} color="#3B82F6" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#1E40AF', fontWeight: '700' }]}>{t('profile.costMonitoring')}</Text>
                    <Text style={[styles.adminSubtext, { color: '#1E40AF' }]}>{t('profile.databaseSize')}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#3B82F6" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#F5F2F7', borderColor: '#A08AB7', borderLeftWidth: 4, borderLeftColor: '#A08AB7' }]}
                onPress={() => router.push('/admin/push-notifications')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="bell-ring" size={24} color="#A08AB7" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#6B21A8', fontWeight: '700' }]}>{t('profile.pushNotifications')}</Text>
                    <Text style={[styles.adminSubtext, { color: '#6B21A8' }]}>{t('profile.sendMessagesToUsers')}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderLeftWidth: 4, borderLeftColor: '#10B981' }]}
                onPress={() => router.push('/admin/verification')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="camera-account" size={24} color="#10B981" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#065F46', fontWeight: '700' }]}>Photo Verification</Text>
                    <Text style={[styles.adminSubtext, { color: '#065F46' }]}>Reset user attempts</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#10B981" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}
                onPress={() => router.push('/admin/photo-reviews')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="image-search" size={24} color="#EF4444" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#991B1B', fontWeight: '700' }]}>Photo Reviews</Text>
                    <Text style={[styles.adminSubtext, { color: '#991B1B' }]}>Review flagged user photos</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}
                onPress={() => router.push('/(onboarding)/basic-info')}
              >
                <View style={styles.menuItemLeft}>
                  <MaterialCommunityIcons name="clipboard-list" size={24} color="#F59E0B" />
                  <View>
                    <Text style={[styles.menuItemText, { color: '#92400E', fontWeight: '700' }]}>Preview Onboarding</Text>
                    <Text style={[styles.adminSubtext, { color: '#92400E' }]}>View all onboarding screens</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#F59E0B" />
              </TouchableOpacity>
            </View>
          )}

          {/* ===== DANGER ZONE ===== */}
          <View style={styles.menuSection}>
            <Text style={[styles.menuSectionTitle, { color: '#EF4444' }]}>{t('profile.dangerZone')}</Text>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: '#FEE2E2' }]}
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
          <Text style={[styles.appVersion, { color: colors.mutedForeground }]}>Accord v1.1.2 (Build 48)</Text>

          {/* Spacing */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Settings Button Overlay */}
      <TouchableOpacity
        style={[styles.settingsButtonOverlay, { top: insets.top + 12 }]}
        onPress={() => router.push('/settings/privacy')}
      >
        <View style={[styles.settingsButtonBackground, { backgroundColor: colors.muted }]}>
          <MaterialCommunityIcons name="cog-outline" size={24} color={colors.mutedForeground} />
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
          <View style={styles.previewContainer}>
            {/* Close Button */}
            <TouchableOpacity
              style={[styles.previewCloseButton, { top: insets.top + 8 }]}
              onPress={() => setShowPreview(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color="#000000" />
            </TouchableOpacity>

            <DiscoveryProfileView
              profile={{
                ...profile,
                compatibility_score: undefined, // Don't show compatibility for own profile
                distance: undefined,
              } as any}
              preferences={preferences}
              heightUnit={(profile?.height_unit as 'imperial' | 'metric') || 'imperial'}
              hideActions={true}
              isOwnProfile={true}
            />
          </View>
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
  avatarSection: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarFallback: {
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A08AB7',
  },
  unverifiedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingsButtonOverlay: {
    position: 'absolute',
    right: 20,
  },
  settingsButtonBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
    borderRadius: 10,
    backgroundColor: '#A08AB7',
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
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#A08AB7',
    backgroundColor: 'transparent',
    marginBottom: 32,
  },
  previewProfileText: {
    fontSize: 16,
    fontWeight: 'bold',
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
    color: '#71717A',
  },
  premiumCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
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
    borderRadius: 16,
    overflow: 'hidden',
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
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
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
  menuItemSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  adminSubtext: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
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
  previewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewCloseButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
