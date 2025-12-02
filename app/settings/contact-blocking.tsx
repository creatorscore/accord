import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Switch } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';

export default function ContactBlocking() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [contactsBlocked, setContactsBlocked] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load current profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setCurrentProfileId(profileData.id);

        // Check how many contacts are blocked
        const { count } = await supabase
          .from('contact_blocks')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profileData.id);

        setContactsBlocked(count || 0);
        setIsEnabled((count || 0) > 0);
      }

      // Check contacts permission
      const { status } = await Contacts.getPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestContactsPermission = async () => {
    // Show detailed explanation before requesting permission
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        `🔒 ${t('contactBlocking.whyWeNeedAccess')}`,
        t('contactBlocking.whyWeNeedAccessExplanation'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: () => {
              setHasPermission(false);
              resolve(false);
            }
          },
          {
            text: t('contactBlocking.iUnderstandContinue'),
            onPress: async () => {
              try {
                const { status } = await Contacts.requestPermissionsAsync();
                const granted = status === 'granted';
                setHasPermission(granted);

                if (!granted) {
                  Alert.alert(
                    t('contactBlocking.permissionDenied'),
                    t('contactBlocking.permissionDeniedMessage'),
                    [{ text: t('common.success') }]
                  );
                }

                resolve(granted);
              } catch (error) {
                console.error('Error requesting permission:', error);
                resolve(false);
              }
            }
          }
        ],
        { cancelable: false }
      );
    });
  };

  const hashPhoneNumber = async (phoneNumber: string): Promise<string> => {
    // Normalize phone number (remove spaces, dashes, etc.)
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    // Hash for privacy
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      normalized
    );
    return hash;
  };

  const blockContacts = async () => {
    if (!currentProfileId) return;

    if (!hasPermission) {
      const granted = await requestContactsPermission();
      if (!granted) {
        Alert.alert(
          t('contactBlocking.permissionRequired'),
          t('contactBlocking.permissionRequiredMessage')
        );
        return;
      }
    }

    setBlocking(true);

    try {
      console.log('📱 Fetching contacts...');

      // Fetch all contacts with phone numbers
      // Note: On Android, we need to explicitly request PhoneNumbers field
      const { data: contactsData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: 10000, // Fetch all contacts at once
        pageOffset: 0,
      });

      console.log(`📱 Found ${contactsData?.length || 0} contacts`);

      if (!contactsData || contactsData.length === 0) {
        Alert.alert(
          t('contactBlocking.noContactsFound'),
          t('contactBlocking.noContactsFoundMessage')
        );
        setBlocking(false);
        return;
      }

      // Extract and hash phone numbers
      const phoneNumbers: string[] = [];
      for (const contact of contactsData) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            if (phone.number) {
              phoneNumbers.push(phone.number);
            }
          }
        }
      }

      console.log(`📱 Extracted ${phoneNumbers.length} phone numbers from contacts`);

      if (phoneNumbers.length === 0) {
        Alert.alert(
          t('contactBlocking.noPhoneNumbers'),
          t('contactBlocking.noPhoneNumbersMessage')
        );
        setBlocking(false);
        return;
      }

      // Hash all phone numbers
      const hashedNumbers = await Promise.all(
        phoneNumbers.map(num => hashPhoneNumber(num))
      );

      console.log(`🔐 Hashed ${hashedNumbers.length} phone numbers`);

      // Insert into database (upsert to avoid duplicates)
      const blocksToInsert = hashedNumbers.map(hash => ({
        profile_id: currentProfileId,
        phone_number: hash,
      }));

      console.log(`💾 Upserting ${blocksToInsert.length} contact blocks to database...`);

      const { error, count } = await supabase
        .from('contact_blocks')
        .upsert(blocksToInsert, {
          onConflict: 'profile_id,phone_number',
          ignoreDuplicates: true,
        });

      if (error) {
        console.error('Database upsert error:', error);
        throw error;
      }

      console.log(`✅ Successfully saved contact blocks`);

      setContactsBlocked(hashedNumbers.length);
      setIsEnabled(true);

      Alert.alert(
        `✅ ${t('contactBlocking.protected')}`,
        t('contactBlocking.protectedMessage', { count: hashedNumbers.length }),
        [{ text: t('contactBlocking.gotIt') }]
      );
    } catch (error: any) {
      console.error('Error blocking contacts:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to block contacts. Please try again.';

      if (error?.message?.includes('permission')) {
        errorMessage = 'Contacts permission was denied. Please enable it in your device settings.';
      } else if (error?.message?.includes('network') || error?.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
        errorMessage = 'Session expired. Please sign out and sign back in.';
      } else if (error?.code === '42501' || error?.message?.includes('policy')) {
        errorMessage = 'Permission denied. Please try signing out and back in.';
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }

      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setBlocking(false);
    }
  };

  const clearBlocks = async () => {
    if (!currentProfileId) return;

    Alert.alert(
      t('contactBlocking.clearContactBlocks'),
      t('contactBlocking.clearContactBlocksMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('contactBlocking.clear'),
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            try {
              const { error } = await supabase
                .from('contact_blocks')
                .delete()
                .eq('profile_id', currentProfileId);

              if (error) throw error;

              setContactsBlocked(0);
              setIsEnabled(false);

              Alert.alert(t('contactBlocking.cleared'), t('contactBlocking.clearedMessage'));
            } catch (error: any) {
              console.error('Error clearing blocks:', error);
              Alert.alert(t('common.error'), t('contactBlocking.clearError'));
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('contactBlocking.title')}</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('contactBlocking.title')}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <MaterialCommunityIcons name="shield-lock" size={32} color="#A08AB7" />
          </View>
          <Text style={styles.infoTitle}>{t('contactBlocking.stayPrivateSafe')}</Text>
          <Text style={styles.infoText}>
            {t('contactBlocking.stayPrivateSafeMessage')}
          </Text>
          <Text style={[styles.infoText, { marginTop: 12, fontWeight: '600' }]}>
            🔐 {t('contactBlocking.privacyProtected')}
          </Text>
          <Text style={[styles.infoText, { marginTop: 4 }]}>
            {t('contactBlocking.privacyProtectedDetails')}
          </Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="phone-off" size={24} color="#6B7280" />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>{t('contactBlocking.contactsBlocked')}</Text>
              <Text style={styles.statusSubtitle}>
                {contactsBlocked === 0
                  ? t('contactBlocking.noContactsBlockedYet')
                  : t('contactBlocking.contactsBlockedCount', { count: contactsBlocked })}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              isEnabled && styles.statusBadgeActive
            ]}>
              <Text style={[
                styles.statusBadgeText,
                isEnabled && styles.statusBadgeTextActive
              ]}>
                {isEnabled ? t('contactBlocking.active') : t('contactBlocking.inactive')}
              </Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('contactBlocking.howItWorks')}</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('contactBlocking.step1Title')}</Text>
              <Text style={styles.stepText}>
                {t('contactBlocking.step1Text')}
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('contactBlocking.step2Title')}</Text>
              <Text style={styles.stepText}>
                {t('contactBlocking.step2Text')}
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{t('contactBlocking.step3Title')}</Text>
              <Text style={styles.stepText}>
                {t('contactBlocking.step3Text')}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!isEnabled || contactsBlocked === 0 ? (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, blocking && styles.buttonDisabled]}
              onPress={blockContacts}
              disabled={blocking}
            >
              {blocking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check" size={20} color="white" />
                  <Text style={styles.buttonText}>{t('contactBlocking.blockMyContacts')}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, blocking && styles.buttonDisabled]}
                onPress={blockContacts}
                disabled={blocking}
              >
                {blocking ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="refresh" size={20} color="white" />
                    <Text style={styles.buttonText}>{t('contactBlocking.updateBlockedContacts')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, blocking && styles.buttonDisabled]}
                onPress={clearBlocks}
                disabled={blocking}
              >
                <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
                <Text style={styles.secondaryButtonText}>{t('contactBlocking.clearAllBlocks')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
          <Text style={styles.privacyText}>
            <Text style={{ fontWeight: '700', color: '#10B981' }}>{t('contactBlocking.privacyGuaranteed')} </Text>
            {t('contactBlocking.privacyGuaranteedText')}
          </Text>
        </View>

        {/* Additional Security Info */}
        <View style={[styles.privacyNotice, { borderColor: '#E0E7FF', backgroundColor: '#EEF2FF', marginTop: 12 }]}>
          <MaterialCommunityIcons name="help-circle" size={20} color="#6366F1" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyText, { color: '#4338CA', fontWeight: '600', marginBottom: 4 }]}>
              {t('contactBlocking.commonQuestions')}
            </Text>
            <Text style={[styles.privacyText, { color: '#4338CA' }]}>
              {t('contactBlocking.commonQuestionsText')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B21A8',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6B21A8',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBadgeTextActive: {
    color: '#059669',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#A08AB7',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
});
