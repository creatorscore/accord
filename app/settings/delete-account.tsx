import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const DELETE_REASONS = [
  { id: 'found_match', label: 'I found what I was looking for' },
  { id: 'not_for_me', label: 'This app isn\'t for me' },
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'privacy_concerns', label: 'Privacy concerns' },
  { id: 'bad_experience', label: 'Bad experience with other users' },
  { id: 'technical_issues', label: 'Technical problems' },
  { id: 'other', label: 'Other reason' },
];

export default function DeleteAccount() {
  const { user, signOut } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText.toUpperCase() !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm account deletion.');
      return;
    }

    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for leaving.');
      return;
    }

    Alert.alert(
      'Delete Account?',
      'This action is PERMANENT and cannot be undone. All your data will be deleted immediately.\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: confirmDeletion,
        },
      ]
    );
  };

  const confirmDeletion = async () => {
    setDeleting(true);

    try {
      // Get auth token for the Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Call the delete-account Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcaktvlosjsaxcntxbyf.supabase.co'}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: selectedReason,
            feedback: feedback.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Sign out user locally
      await signOut();

      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted. We\'re sorry to see you go.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/welcome'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to delete account. Please contact support at support@joinaccord.app for assistance.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="alert" size={32} color="#EF4444" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>This action is permanent</Text>
            <Text style={styles.warningText}>
              Once you delete your account, there is no going back. All your data will be permanently removed.
            </Text>
          </View>
        </View>

        {/* What Gets Deleted */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What will be deleted:</Text>
          <View style={styles.deletionList}>
            {[
              'Your profile and photos',
              'All your matches and connections',
              'All your messages and conversations',
              'Your subscription (if active)',
              'Your preferences and settings',
              'Your verification status',
            ].map((item, index) => (
              <View key={index} style={styles.deletionItem}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.deletionItemText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Alternatives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before you go...</Text>
          <Text style={styles.sectionDescription}>
            Consider these alternatives to deleting your account:
          </Text>

          <TouchableOpacity style={styles.alternativeCard}>
            <MaterialCommunityIcons name="pause-circle" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Take a Break</Text>
              <Text style={styles.alternativeText}>
                Hide your profile temporarily without losing your data
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.alternativeCard}>
            <MaterialCommunityIcons name="eye-off" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Privacy Settings</Text>
              <Text style={styles.alternativeText}>
                Control who can see your profile and contact you
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.alternativeCard}>
            <MaterialCommunityIcons name="email" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Contact Support</Text>
              <Text style={styles.alternativeText}>
                We're here to help with any issues you're experiencing
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Deletion Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tell us why you're leaving</Text>
          <Text style={styles.sectionDescription}>
            Your feedback helps us improve Accord for everyone
          </Text>

          {DELETE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonOption,
                selectedReason === reason.id && styles.reasonOptionSelected,
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View style={styles.radioOuter}>
                {selectedReason === reason.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.reasonLabel}>{reason.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.feedbackInput}
            placeholder="Additional feedback (optional)"
            placeholderTextColor="#9CA3AF"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.characterCount}>{feedback.length}/500</Text>
        </View>

        {/* Confirmation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type DELETE to confirm</Text>
          <Text style={styles.sectionDescription}>
            This confirms that you understand this action is permanent
          </Text>

          <TextInput
            style={styles.confirmInput}
            placeholder="Type DELETE here"
            placeholderTextColor="#9CA3AF"
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            (deleting || confirmText.toUpperCase() !== 'DELETE' || !selectedReason) &&
              styles.deleteButtonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={deleting || confirmText.toUpperCase() !== 'DELETE' || !selectedReason}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="delete-forever" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Account Permanently</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          If you're having trouble deleting your account, contact us at support@joinaccord.app
        </Text>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    gap: 16,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  deletionList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  deletionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  deletionItemText: {
    fontSize: 14,
    color: '#374151',
  },
  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  alternativeContent: {
    flex: 1,
  },
  alternativeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  alternativeText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  reasonOptionSelected: {
    borderColor: '#A08AB7',
    backgroundColor: '#F3E8FF',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A08AB7',
  },
  reasonLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  feedbackInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  confirmInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
    padding: 16,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  footerNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 32,
    marginHorizontal: 20,
    lineHeight: 18,
  },
});
