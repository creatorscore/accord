import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';

type FeedbackType = 'bug_report' | 'feature_request' | 'general_feedback' | 'usability_issue';

export default function BetaFeedback() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general_feedback');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [email, setEmail] = useState('');
  const [allowContact, setAllowContact] = useState(true);

  // Ratings
  const [ratingOverall, setRatingOverall] = useState(0);
  const [ratingEaseOfUse, setRatingEaseOfUse] = useState(0);
  const [ratingMatchingQuality, setRatingMatchingQuality] = useState(0);
  const [ratingPerformance, setRatingPerformance] = useState(0);
  const [ratingDesign, setRatingDesign] = useState(0);

  const feedbackTypes: { value: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'bug_report', label: t('betaFeedback.types.bugReport'), icon: 'bug' },
    { value: 'feature_request', label: t('betaFeedback.types.featureRequest'), icon: 'bulb' },
    { value: 'usability_issue', label: t('betaFeedback.types.usabilityIssue'), icon: 'hand-left' },
    { value: 'general_feedback', label: t('betaFeedback.types.generalFeedback'), icon: 'chatbubble' },
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert(t('betaFeedback.alerts.missingInfoTitle'), t('betaFeedback.alerts.missingInfoMessage'));
      return;
    }

    if (feedbackType !== 'feature_request' && feedbackType !== 'general_feedback' && ratingOverall === 0) {
      Alert.alert(t('betaFeedback.alerts.ratingRequiredTitle'), t('betaFeedback.alerts.ratingRequiredMessage'));
      return;
    }

    try {
      setLoading(true);

      // Get user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Collect device info
      const deviceInfo = {
        platform: Platform.OS,
        os_version: Platform.Version,
        app_version: Constants.expoConfig?.version || '1.0.0',
        device_model: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
      };

      // Submit feedback
      const { error } = await supabase.from('beta_feedback').insert({
        profile_id: profile.id,
        feedback_type: feedbackType,
        subject: subject.trim(),
        description: description.trim(),
        steps_to_reproduce: feedbackType === 'bug_report' ? stepsToReproduce.trim() : null,
        expected_behavior: feedbackType === 'bug_report' ? expectedBehavior.trim() : null,
        actual_behavior: feedbackType === 'bug_report' ? actualBehavior.trim() : null,
        rating_overall: ratingOverall || null,
        rating_ease_of_use: ratingEaseOfUse || null,
        rating_matching_quality: ratingMatchingQuality || null,
        rating_performance: ratingPerformance || null,
        rating_design: ratingDesign || null,
        device_info: deviceInfo,
        user_email: email.trim() || null,
        allow_contact: allowContact,
      });

      if (error) throw error;

      Alert.alert(
        t('betaFeedback.alerts.successTitle'),
        t('betaFeedback.alerts.successMessage'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      Alert.alert(t('common.error'), t('betaFeedback.alerts.errorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, setRating: (value: number) => void, label: string) => (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={28}
              color={star <= rating ? '#F59E0B' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('betaFeedback.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Feedback Type Selection */}
        <Text style={styles.sectionTitle}>{t('betaFeedback.feedbackTypeQuestion')}</Text>
        <View style={styles.typeGrid}>
          {feedbackTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[styles.typeCard, feedbackType === type.value && styles.typeCardActive]}
              onPress={() => setFeedbackType(type.value)}
            >
              <Ionicons
                name={type.icon}
                size={24}
                color={feedbackType === type.value ? '#A08AB7' : '#6B7280'}
              />
              <Text
                style={[styles.typeLabel, feedbackType === type.value && styles.typeLabelActive]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subject */}
        <Text style={styles.sectionTitle}>{t('betaFeedback.subject')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('betaFeedback.subjectPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={subject}
          onChangeText={setSubject}
          maxLength={100}
        />

        {/* Description */}
        <Text style={styles.sectionTitle}>{t('betaFeedback.description')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('betaFeedback.descriptionPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={1000}
        />

        {/* Bug Report Fields */}
        {feedbackType === 'bug_report' && (
          <>
            <Text style={styles.sectionTitle}>{t('betaFeedback.stepsToReproduce')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('betaFeedback.stepsPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={stepsToReproduce}
              onChangeText={setStepsToReproduce}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.sectionTitle}>{t('betaFeedback.expectedBehavior')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('betaFeedback.expectedPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={expectedBehavior}
              onChangeText={setExpectedBehavior}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <Text style={styles.sectionTitle}>{t('betaFeedback.actualBehavior')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('betaFeedback.actualPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={actualBehavior}
              onChangeText={setActualBehavior}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </>
        )}

        {/* Ratings */}
        {feedbackType !== 'feature_request' && (
          <>
            <Text style={styles.sectionTitle}>{t('betaFeedback.ratingsOptional')}</Text>
            <View style={styles.ratingsCard}>
              {renderStars(ratingOverall, setRatingOverall, t('betaFeedback.ratings.overall'))}
              {renderStars(ratingEaseOfUse, setRatingEaseOfUse, t('betaFeedback.ratings.easeOfUse'))}
              {renderStars(ratingMatchingQuality, setRatingMatchingQuality, t('betaFeedback.ratings.matchQuality'))}
              {renderStars(ratingPerformance, setRatingPerformance, t('betaFeedback.ratings.performance'))}
              {renderStars(ratingDesign, setRatingDesign, t('betaFeedback.ratings.design'))}
            </View>
          </>
        )}

        {/* Contact Info */}
        <Text style={styles.sectionTitle}>{t('betaFeedback.emailOptional')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('betaFeedback.emailPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAllowContact(!allowContact)}
        >
          <Ionicons
            name={allowContact ? 'checkbox' : 'square-outline'}
            size={24}
            color="#A08AB7"
          />
          <Text style={styles.checkboxLabel}>{t('betaFeedback.allowContact')}</Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>{t('betaFeedback.submitButton')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('betaFeedback.thankYouMessage')}
          </Text>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeCardActive: {
    borderColor: '#A08AB7',
    backgroundColor: '#F3F0FF',
  },
  typeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  typeLabelActive: {
    color: '#A08AB7',
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  ratingsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  submitButton: {
    backgroundColor: '#A08AB7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
