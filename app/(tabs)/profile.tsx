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
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import ProfilePhotoCarousel from '@/components/profile/ProfilePhotoCarousel';
import ProfileStoryCard from '@/components/profile/ProfileStoryCard';
import ProfileInteractiveSection from '@/components/profile/ProfileInteractiveSection';
import ProfileQuickFacts from '@/components/profile/ProfileQuickFacts';
import ProfileVoiceNote from '@/components/profile/ProfileVoiceNote';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';

interface ProfileData {
  id: string;
  display_name: string;
  age: number;
  bio?: string;
  occupation?: string;
  education?: string;
  location_city?: string;
  location_state?: string;
  gender?: string;
  sexual_orientation?: string;
  is_verified: boolean;
  photos?: Array<{ url: string; is_primary?: boolean; display_order?: number; caption?: string }>;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
  interests?: string[];
  voice_intro_url?: string;
  voice_intro_duration?: number;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isPremium, isPlatinum, subscriptionTier, isLoading: subscriptionLoading } = useSubscription();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // Reload profile when user changes (handles OAuth sign-in timing)
  useEffect(() => {
    if (user?.id && !profile) {
      loadProfile();
    }
  }, [user]);

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
          age,
          bio,
          occupation,
          education,
          location_city,
          location_state,
          gender,
          sexual_orientation,
          is_verified,
          prompt_answers,
          interests,
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

      // Add mock captions for demo
      const enhancedPhotos = data.photos?.sort((a: any, b: any) =>
        (a.display_order || 0) - (b.display_order || 0)
      ).map((photo: any, index: number) => ({
        ...photo,
        caption: index === 0 ? "Living my best life" :
                 index === 1 ? "Adventures await" :
                 index === 2 ? "Cherishing moments" : undefined
      }));

      setProfile({
        ...data,
        photos: enhancedPhotos,
      });
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert(
        'Error Loading Profile',
        'There was a problem loading your profile. Please try again.',
        [
          {
            text: 'Sign Out',
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
          { text: 'Retry', onPress: loadProfile }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
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
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Prepare quick facts for display
  const quickFacts = [];
  if (profile?.occupation) {
    quickFacts.push({
      emoji: '💼',
      label: 'Work',
      value: profile.occupation,
    });
  }
  if (profile?.location_city) {
    quickFacts.push({
      emoji: '📍',
      label: 'Location',
      value: profile.location_city,
    });
  }
  if (profile?.education) {
    quickFacts.push({
      emoji: '🎓',
      label: 'Education',
      value: profile.education,
    });
  }
  if (profile?.is_verified) {
    quickFacts.push({
      emoji: '✅',
      label: 'Status',
      value: 'Verified',
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Enhanced Photo Carousel */}
        {profile?.photos && profile.photos.length > 0 ? (
          <ProfilePhotoCarousel
            photos={profile.photos}
            name={profile.display_name}
            age={profile.age}
            isVerified={profile.is_verified}
          />
        ) : (
          <View style={styles.placeholderHeader}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderGradient}
            >
              <View style={styles.placeholderPhotoContainer}>
                <MaterialCommunityIcons name="camera-plus" size={40} color="white" />
                <Text style={styles.placeholderText}>Add Photos</Text>
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
              title="My Story"
              icon="book-open-variant"
              content={profile.bio}
              gradient={['#8B5CF6', '#EC4899']}
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

          {/* Interests Section */}
          {profile?.interests && profile.interests.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: 12,
              }}>My Interests</Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {profile.interests.map((interest, index) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                    style={{
                      backgroundColor: index % 3 === 0 ? '#EDE9FE' :
                                       index % 3 === 1 ? '#FEF3C7' : '#DBEAFE',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{
                      color: index % 3 === 0 ? '#7C3AED' :
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
              title="About Me"
              expandable={false}
              items={[
                ...(profile.occupation ? [{
                  icon: 'briefcase',
                  label: 'Career',
                  value: profile.occupation,
                }] : []),
                ...(profile.education ? [{
                  icon: 'school',
                  label: 'Education',
                  value: profile.education,
                }] : []),
                ...(profile.location_city ? [{
                  icon: 'map-marker',
                  label: 'Location',
                  value: `${profile.location_city}${profile.location_state ? `, ${profile.location_state}` : ''}`,
                }] : []),
                ...(profile.gender ? [{
                  icon: 'gender-transgender',
                  label: 'Gender',
                  value: profile.gender,
                }] : []),
                ...(profile.sexual_orientation ? [{
                  icon: 'heart',
                  label: 'Orientation',
                  value: profile.sexual_orientation,
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
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.editProfileGradient}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="white" />
              <Text style={styles.editProfileText}>Edit Your Profile</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Preview Profile Button */}
          <TouchableOpacity
            style={styles.previewProfileButton}
            onPress={handlePreviewProfile}
          >
            <MaterialCommunityIcons name="eye-outline" size={20} color="#8B5CF6" />
            <Text style={styles.previewProfileText}>Preview Profile</Text>
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
            colors={isPlatinum ? ['#FFD700', '#FFA500'] : ['#8B5CF6', '#EC4899']}
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
                  {isPlatinum ? 'Platinum Member' : 'Premium Member'}
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
                ? 'Enjoying all Platinum features'
                : 'Enjoying all Premium features'}
            </Text>

            {/* Premium Benefits */}
            <View style={styles.premiumBenefits}>
              {[
                'Unlimited swipes',
                'See who likes you',
                isPlatinum ? 'Weekly profile boost' : '5 Super Likes/week',
                isPlatinum ? 'Priority support' : 'Voice messages',
              ].map((benefit, i) => (
                <View key={i} style={styles.benefitRow}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="white" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {!isPlatinum && (
              <TouchableOpacity
                style={styles.upgradeToPlatinum}
                onPress={() => setShowPaywall(true)}
              >
                <MaterialCommunityIcons name="crown" size={16} color="#8B5CF6" />
                <Text style={styles.upgradeToPlatinumText}>Upgrade to Platinum</Text>
              </TouchableOpacity>
            )}
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
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <MaterialCommunityIcons name="crown" size={40} color="white" />
              </View>

              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>
                Get unlimited swipes, see who likes you, and more
              </Text>

              <View style={styles.upgradeFeatures}>
                {[
                  'Unlimited swipes',
                  'See who likes you',
                  'Advanced filters',
                  'Read receipts & voice messages',
                ].map((feature, i) => (
                  <View key={i} style={styles.upgradeFeatureRow}>
                    <MaterialCommunityIcons name="check" size={18} color="white" />
                    <Text style={styles.upgradeFeatureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.upgradeCTA}>
                <Text style={styles.upgradeCTAText}>Unlock Premium Features</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#8B5CF6" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </MotiView>
          )}

          {/* Menu Items */}
          <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Account</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/settings/privacy')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="cog-outline" size={24} color="#6B7280" />
            <Text style={styles.menuItemText}>Settings & Privacy</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Verification', 'Verification coming soon')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#6B7280" />
            <Text style={styles.menuItemText}>Identity Verification</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>

        {isPremium && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings/subscription')}
          >
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="credit-card-outline" size={24} color="#6B7280" />
              <Text style={styles.menuItemText}>Manage Subscription</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/settings/safety-center')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#6B7280" />
            <Text style={styles.menuItemText}>Safety Center</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/settings/blocked-users')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="cancel" size={24} color="#6B7280" />
            <Text style={styles.menuItemText}>Blocked Users</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            Linking.openURL('mailto:hello@joinaccord.app?subject=Support Request&body=Hi Accord Team,\n\n');
          }}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={24} color="#6B7280" />
            <Text style={styles.menuItemText}>Help & Support</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Danger Zone</Text>

        <TouchableOpacity
          style={[styles.menuItem, { borderColor: '#FEE2E2', borderWidth: 1 }]}
          onPress={() => router.push('/settings/delete-account')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="delete-forever" size={24} color="#EF4444" />
            <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Account</Text>
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
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* App Info */}
          <Text style={styles.appVersion}>Accord v1.0.0</Text>

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
            }}
            preferences={preferences}
            onClose={() => setShowPreview(false)}
            visible={showPreview}
            isMatched={true} // Hide swipe actions for self-preview
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
    backgroundColor: '#F9FAFB',
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
    borderColor: '#8B5CF6',
    backgroundColor: 'white',
    marginBottom: 20,
  },
  previewProfileText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
    fontWeight: 'bold',
    color: '#8B5CF6',
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
    fontWeight: 'bold',
    color: '#8B5CF6',
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
