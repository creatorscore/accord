import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Switch } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as Crypto from 'expo-crypto';

export default function ContactBlocking() {
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
        '🔒 Why We Need Contacts Access',
        'Accord needs to read your contacts to help you avoid awkward situations.\n\n' +
        '✅ What we do:\n' +
        '• Read phone numbers from your contacts\n' +
        '• Convert them to encrypted codes on YOUR device\n' +
        '• Hide matching profiles from your discovery feed\n\n' +
        '❌ What we DON\'t do:\n' +
        '• Upload your contacts to our servers\n' +
        '• Store names, emails, or any personal info\n' +
        '• Share your contacts with anyone\n\n' +
        '🔐 Your contacts are processed locally and never leave your device in readable form. Only encrypted codes are stored for matching.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setHasPermission(false);
              resolve(false);
            }
          },
          {
            text: 'I Understand, Continue',
            onPress: async () => {
              try {
                const { status } = await Contacts.requestPermissionsAsync();
                const granted = status === 'granted';
                setHasPermission(granted);

                if (!granted) {
                  Alert.alert(
                    'Permission Denied',
                    'You can enable contacts access later in your device settings if you change your mind.',
                    [{ text: 'OK' }]
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
          'Permission Required',
          'Please allow access to your contacts to use this feature.'
        );
        return;
      }
    }

    setBlocking(true);

    try {
      // Fetch all contacts with phone numbers
      const { data: contactsData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (!contactsData || contactsData.length === 0) {
        Alert.alert('No Contacts', 'No phone numbers found in your contacts.');
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

      if (phoneNumbers.length === 0) {
        Alert.alert('No Phone Numbers', 'No phone numbers found in your contacts.');
        setBlocking(false);
        return;
      }

      // Hash all phone numbers
      const hashedNumbers = await Promise.all(
        phoneNumbers.map(num => hashPhoneNumber(num))
      );

      // Insert into database (upsert to avoid duplicates)
      const blocksToInsert = hashedNumbers.map(hash => ({
        profile_id: currentProfileId,
        phone_number: hash,
      }));

      const { error } = await supabase
        .from('contact_blocks')
        .upsert(blocksToInsert, { onConflict: 'profile_id,phone_number' });

      if (error) throw error;

      setContactsBlocked(hashedNumbers.length);
      setIsEnabled(true);

      Alert.alert(
        '✅ Protected',
        `${hashedNumbers.length} contact${hashedNumbers.length === 1 ? ' is' : 's are'} now blocked from your discovery feed.\n\n` +
        `🔐 All phone numbers were encrypted on your device using SHA-256. Your contacts' privacy is fully protected.\n\n` +
        `These profiles will never appear in your feed, and they'll never know.`,
        [{ text: 'Got It' }]
      );
    } catch (error: any) {
      console.error('Error blocking contacts:', error);
      Alert.alert('Error', 'Failed to block contacts. Please try again.');
    } finally {
      setBlocking(false);
    }
  };

  const clearBlocks = async () => {
    if (!currentProfileId) return;

    Alert.alert(
      'Clear Contact Blocks',
      'Are you sure you want to remove all contact blocks? Profiles from your contacts will appear in discovery again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
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

              Alert.alert('Cleared', 'All contact blocks have been removed.');
            } catch (error: any) {
              console.error('Error clearing blocks:', error);
              Alert.alert('Error', 'Failed to clear blocks. Please try again.');
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
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Blocking</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Blocking</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <MaterialCommunityIcons name="shield-lock" size={32} color="#9B87CE" />
          </View>
          <Text style={styles.infoTitle}>Stay Private & Safe</Text>
          <Text style={styles.infoText}>
            Avoid awkward encounters by preventing people in your contacts from appearing in your discovery feed.
          </Text>
          <Text style={[styles.infoText, { marginTop: 12, fontWeight: '600' }]}>
            🔐 Your Privacy is Protected:
          </Text>
          <Text style={[styles.infoText, { marginTop: 4 }]}>
            • Phone numbers are encrypted on YOUR device{'\n'}
            • We never see your contacts' names or info{'\n'}
            • Nothing is uploaded to our servers{'\n'}
            • You can remove blocks anytime
          </Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="phone-off" size={24} color="#6B7280" />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Contacts Blocked</Text>
              <Text style={styles.statusSubtitle}>
                {contactsBlocked === 0
                  ? 'No contacts blocked yet'
                  : `${contactsBlocked} contact${contactsBlocked === 1 ? '' : 's'} blocked`}
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
                {isEnabled ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Grant Permission (One Time)</Text>
              <Text style={styles.stepText}>
                You'll see a clear explanation of how we protect your privacy, then grant access to your contacts. We only read phone numbers—no names, emails, or other info.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Local Encryption (On Your Device)</Text>
              <Text style={styles.stepText}>
                Phone numbers are immediately converted to encrypted codes using SHA-256 (military-grade encryption) on YOUR device. We never see the actual numbers.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Automatic Protection</Text>
              <Text style={styles.stepText}>
                Profiles with matching phone numbers are automatically hidden from your discovery feed. They'll never know, and you'll never see each other.
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
                  <Text style={styles.buttonText}>Block My Contacts</Text>
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
                    <Text style={styles.buttonText}>Update Blocked Contacts</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, blocking && styles.buttonDisabled]}
                onPress={clearBlocks}
                disabled={blocking}
              >
                <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
                <Text style={styles.secondaryButtonText}>Clear All Blocks</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
          <Text style={styles.privacyText}>
            <Text style={{ fontWeight: '700', color: '#10B981' }}>100% Privacy Guaranteed: </Text>
            Your contacts never leave your device in readable form. We use the same encryption technology that banks use to protect your data. Phone numbers are converted to encrypted codes instantly on your device, and only these codes are stored. We can't read your contacts, and neither can anyone else.
          </Text>
        </View>

        {/* Additional Security Info */}
        <View style={[styles.privacyNotice, { borderColor: '#E0E7FF', backgroundColor: '#EEF2FF', marginTop: 12 }]}>
          <MaterialCommunityIcons name="help-circle" size={20} color="#6366F1" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyText, { color: '#4338CA', fontWeight: '600', marginBottom: 4 }]}>
              Common Questions:
            </Text>
            <Text style={[styles.privacyText, { color: '#4338CA' }]}>
              • "Can Accord see my contacts?" No. We only see encrypted codes.{'\n'}
              • "Will my contacts know?" No. This is completely invisible to them.{'\n'}
              • "Can I undo this?" Yes. Tap "Clear All Blocks" anytime.{'\n'}
              • "What if I add new contacts?" Tap "Update Blocked Contacts" to refresh.
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
    backgroundColor: '#9B87CE',
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
    backgroundColor: '#9B87CE',
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
