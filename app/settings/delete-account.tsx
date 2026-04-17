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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/lib/useColorScheme';
import { supabase } from '@/lib/supabase';

export default function DeleteAccount() {
  const { t } = useTranslation();
  const { isDarkColorScheme } = useColorScheme();
  const { user, signOut } = useAuth();

  const DELETE_REASONS = [
    { id: 'found_match', label: t('deleteAccount.reasons.foundMatch') },
    { id: 'not_for_me', label: t('deleteAccount.reasons.notForMe') },
    { id: 'too_expensive', label: t('deleteAccount.reasons.tooExpensive') },
    { id: 'privacy_concerns', label: t('deleteAccount.reasons.privacyConcerns') },
    { id: 'bad_experience', label: t('deleteAccount.reasons.badExperience') },
    { id: 'technical_issues', label: t('deleteAccount.reasons.technicalIssues') },
    { id: 'other', label: t('deleteAccount.reasons.other') },
  ];
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText.toUpperCase() !== 'DELETE') {
      Alert.alert(t('common.error'), t('deleteAccount.alerts.typeDeleteToConfirm'));
      return;
    }

    if (!selectedReason) {
      Alert.alert(t('common.error'), t('deleteAccount.alerts.selectReason'));
      return;
    }

    Alert.alert(
      t('deleteAccount.alerts.confirmTitle'),
      t('deleteAccount.alerts.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deleteAccount.alerts.deletePermanently'),
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
        t('deleteAccount.alerts.successTitle'),
        t('deleteAccount.alerts.successMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => router.replace('/(auth)/welcome'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('deleteAccount.alerts.errorMessage')
      );
    } finally {
      setDeleting(false);
    }
  };

  const dark = isDarkColorScheme;
  const dynamicStyles = {
    container: { backgroundColor: dark ? '#0F0F1A' : '#F9FAFB' },
    header: { backgroundColor: dark ? '#1C1C2E' : '#fff', borderBottomColor: dark ? '#2C2C3E' : '#E5E7EB' },
    headerTitle: { color: dark ? '#F5F5F7' : '#111827' },
    sectionTitle: { color: dark ? '#F5F5F7' : '#111827' },
    sectionDescription: { color: dark ? '#9CA3AF' : '#6B7280' },
    deletionList: { backgroundColor: dark ? '#1C1C2E' : '#fff' },
    deletionItemText: { color: dark ? '#D1D5DB' : '#374151' },
    alternativeCard: { backgroundColor: dark ? '#1C1C2E' : '#fff', borderColor: dark ? '#2C2C3E' : '#E5E7EB' },
    alternativeTitle: { color: dark ? '#F5F5F7' : '#111827' },
    alternativeText: { color: dark ? '#9CA3AF' : '#6B7280' },
    reasonOption: { backgroundColor: dark ? '#1C1C2E' : '#fff', borderColor: dark ? '#2C2C3E' : '#E5E7EB' },
    reasonOptionSelected: { borderColor: '#A08AB7', backgroundColor: dark ? '#2C2C3E' : '#F3E8FF' },
    reasonLabel: { color: dark ? '#D1D5DB' : '#374151' },
    feedbackInput: { backgroundColor: dark ? '#1C1C2E' : '#fff', borderColor: dark ? '#2C2C3E' : '#E5E7EB', color: dark ? '#F5F5F7' : '#111827' },
    confirmInput: { backgroundColor: dark ? '#1C1C2E' : '#fff', color: dark ? '#F5F5F7' : '#111827' },
    characterCount: { color: dark ? '#6B7280' : '#9CA3AF' },
    footerNote: { color: dark ? '#6B7280' : '#9CA3AF' },
    radioOuter: { borderColor: dark ? '#4B5563' : '#D1D5DB' },
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dynamicStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={dark ? '#F5F5F7' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>{t('deleteAccount.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Warning Banner */}
        <View style={[styles.warningBanner, dark && { backgroundColor: '#2C1B1B', borderColor: '#5C2020' }]}>
          <MaterialCommunityIcons name="alert" size={32} color="#EF4444" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>{t('deleteAccount.warningTitle')}</Text>
            <Text style={styles.warningText}>
              {t('deleteAccount.warningText')}
            </Text>
          </View>
        </View>

        {/* What Gets Deleted */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('deleteAccount.whatWillBeDeleted')}</Text>
          <View style={[styles.deletionList, dynamicStyles.deletionList]}>
            {[
              t('deleteAccount.deletionItems.profile'),
              t('deleteAccount.deletionItems.matches'),
              t('deleteAccount.deletionItems.messages'),
              t('deleteAccount.deletionItems.subscription'),
              t('deleteAccount.deletionItems.preferences'),
              t('deleteAccount.deletionItems.verification'),
            ].map((item, index) => (
              <View key={index} style={styles.deletionItem}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
                <Text style={[styles.deletionItemText, dynamicStyles.deletionItemText]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Alternatives */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('deleteAccount.beforeYouGo')}</Text>
          <Text style={[styles.sectionDescription, dynamicStyles.sectionDescription]}>
            {t('deleteAccount.considerAlternatives')}
          </Text>

          <TouchableOpacity style={[styles.alternativeCard, dynamicStyles.alternativeCard]}>
            <MaterialCommunityIcons name="pause-circle" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={[styles.alternativeTitle, dynamicStyles.alternativeTitle]}>{t('deleteAccount.alternatives.takeBreak')}</Text>
              <Text style={[styles.alternativeText, dynamicStyles.alternativeText]}>
                {t('deleteAccount.alternatives.takeBreakDesc')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.alternativeCard, dynamicStyles.alternativeCard]}>
            <MaterialCommunityIcons name="eye-off" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={[styles.alternativeTitle, dynamicStyles.alternativeTitle]}>{t('deleteAccount.alternatives.privacySettings')}</Text>
              <Text style={[styles.alternativeText, dynamicStyles.alternativeText]}>
                {t('deleteAccount.alternatives.privacySettingsDesc')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.alternativeCard, dynamicStyles.alternativeCard]}>
            <MaterialCommunityIcons name="email" size={24} color="#A08AB7" />
            <View style={styles.alternativeContent}>
              <Text style={[styles.alternativeTitle, dynamicStyles.alternativeTitle]}>{t('deleteAccount.alternatives.contactSupport')}</Text>
              <Text style={[styles.alternativeText, dynamicStyles.alternativeText]}>
                {t('deleteAccount.alternatives.contactSupportDesc')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Deletion Form */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('deleteAccount.tellUsWhy')}</Text>
          <Text style={[styles.sectionDescription, dynamicStyles.sectionDescription]}>
            {t('deleteAccount.feedbackHelps')}
          </Text>

          {DELETE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonOption,
                dynamicStyles.reasonOption,
                selectedReason === reason.id && [styles.reasonOptionSelected, dynamicStyles.reasonOptionSelected],
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View style={[styles.radioOuter, dynamicStyles.radioOuter]}>
                {selectedReason === reason.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={[styles.reasonLabel, dynamicStyles.reasonLabel]}>{reason.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={[styles.feedbackInput, dynamicStyles.feedbackInput]}
            placeholder={t('deleteAccount.additionalFeedback')}
            placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={[styles.characterCount, dynamicStyles.characterCount]}>{feedback.length}/500</Text>
        </View>

        {/* Confirmation */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{t('deleteAccount.typeDeleteToConfirm')}</Text>
          <Text style={[styles.sectionDescription, dynamicStyles.sectionDescription]}>
            {t('deleteAccount.confirmUnderstand')}
          </Text>

          <TextInput
            style={[styles.confirmInput, dynamicStyles.confirmInput]}
            placeholder={t('deleteAccount.typeDeletePlaceholder')}
            placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
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
              <Text style={styles.deleteButtonText}>{t('deleteAccount.deleteButtonText')}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerNote, dynamicStyles.footerNote]}>
          {t('deleteAccount.footerNote')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: 40,
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
