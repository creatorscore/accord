import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { validateContent } from '@/lib/content-moderation';
import { PROMPT_KEYS } from '@/lib/prompt-options';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';

interface PromptsDraft {
  selectedPrompts: PromptAnswer[];
}

interface PromptAnswer {
  prompt: string;
  answer: string;
}

export default function Prompts() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const PROMPTS = useMemo(() => PROMPT_KEYS.map(key => t(`prompts.${key}`)), [t]);

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedPrompts, setSelectedPrompts] = useState<PromptAnswer[]>([
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
  ]);
  const [showPicker, setShowPicker] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<PromptsDraft>(user?.id, 'prompts');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prompt_answers')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        if (data.prompt_answers && Array.isArray(data.prompt_answers) && data.prompt_answers.length > 0) {
          const loadedPrompts = [...data.prompt_answers];
          while (loadedPrompts.length < 3) {
            loadedPrompts.push({ prompt: '', answer: '' });
          }
          setSelectedPrompts(loadedPrompts.slice(0, 3));
        }
      }

      // Overlay draft on top of DB data
      const draft = await loadDraft();
      if (draft) {
        if (draft.data.selectedPrompts?.length) setSelectedPrompts(draft.data.selectedPrompts);
        setSubStep(draft.subStep);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const selectPrompt = (prompt: string) => {
    const newPrompts = [...selectedPrompts];
    newPrompts[subStep] = { prompt, answer: newPrompts[subStep].answer };
    setSelectedPrompts(newPrompts);
    setShowPicker(false);
    setShowCustomInput(false);
  };

  const saveCustomPrompt = () => {
    if (!customPromptText.trim() || customPromptText.trim().length < 10) return;

    const validation = validateContent(customPromptText, {
      checkProfanity: true,
      checkContactInfo: false,
      checkGibberish: true,
      fieldName: 'custom prompt',
    });

    if (!validation.isValid) {
      Alert.alert(
        validation.moderationResult?.isGibberish ? t('onboarding.promptsStep.invalidPrompt') : t('onboarding.promptsStep.inappropriateContent'),
        validation.error
      );
      return;
    }

    selectPrompt(customPromptText.trim());
    setCustomPromptText('');
  };

  const updateAnswer = (answer: string) => {
    const newPrompts = [...selectedPrompts];
    newPrompts[subStep].answer = answer;
    setSelectedPrompts(newPrompts);
  };

  const handleSaveAndContinue = async () => {
    const filledPrompts = selectedPrompts.filter(p => p.prompt && p.answer.trim());

    if (filledPrompts.length === 0) {
      Alert.alert(t('common.required'), t('onboarding.promptsStep.answerAtLeastOne'));
      return;
    }

    for (let i = 0; i < filledPrompts.length; i++) {
      const validation = validateContent(filledPrompts[i].answer, {
        checkProfanity: true,
        checkContactInfo: true,
        checkGibberish: true,
        fieldName: 'prompt answer',
      });
      if (!validation.isValid) {
        Alert.alert(
          validation.moderationResult?.isGibberish ? t('onboarding.promptsStep.invalidResponse') : t('onboarding.promptsStep.inappropriateContent'),
          validation.error
        );
        return;
      }
    }

    if (!profileId) {
      Alert.alert(t('common.error'), t('onboarding.common.profileNotFound'));
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          prompt_answers: filledPrompts,
          onboarding_step: 6,
        })
        .eq('id', profileId);

      if (error) throw error;

      await clearDraft();
      router.push('/(onboarding)/voice-intro');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.promptsStep.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const buildDraftSnapshot = (): PromptsDraft => ({ selectedPrompts });

  const handleBack = () => {
    if (showPicker || showCustomInput) {
      setShowPicker(false);
      setShowCustomInput(false);
      return;
    }
    if (subStep === 0) {
      goToPreviousOnboardingStep('/(onboarding)/prompts');
    } else {
      const prevStep = subStep - 1;
      saveDraft(prevStep, buildDraftSnapshot());
      setSubStep(prevStep);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < 2) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const handleSkip = () => {
    if (subStep < 2) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const currentPrompt = selectedPrompts[subStep];
  const usedPrompts = selectedPrompts.map(p => p.prompt).filter(Boolean);
  const availablePrompts = PROMPTS.filter(p => !usedPrompts.includes(p) || p === currentPrompt.prompt);

  const getStepConfig = () => {
    switch (subStep) {
      case 0: return { title: t('onboarding.promptsStep.step0Title'), subtitle: t('onboarding.promptsStep.step0Subtitle') };
      case 1: return { title: t('onboarding.promptsStep.step1Title'), subtitle: t('onboarding.promptsStep.step1Subtitle') };
      case 2: return { title: t('onboarding.promptsStep.step2Title'), subtitle: t('onboarding.promptsStep.step2Subtitle') };
      default: return { title: "", subtitle: "" };
    }
  };

  const { title, subtitle } = getStepConfig();
  const isFirstPromptRequired = subStep === 0 && (!currentPrompt.prompt || !currentPrompt.answer.trim());
  const hasAtLeastOnePrompt = selectedPrompts.some(p => p.prompt && p.answer.trim());

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('prompts', subStep)}
      title={title}
      subtitle={subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={undefined}
      continueDisabled={loading || (subStep === 0 && !hasAtLeastOnePrompt && (!currentPrompt.prompt || !currentPrompt.answer.trim()))}
      continueLabel={loading ? t('common.saving') : t('common.continue')}
      currentRoute="/(onboarding)/prompts"
    >
      {/* Prompt Picker View */}
      {showPicker ? (
        <View>
          {/* Write Your Own */}
          <TouchableOpacity
            style={styles.writeOwnButton}
            onPress={() => { setShowPicker(false); setShowCustomInput(true); }}
          >
            <MaterialCommunityIcons name="pencil-plus" size={22} color="#A08AB7" />
            <Text style={[styles.writeOwnText, { color: isDark ? '#D4C4E8' : '#A08AB7' }]}>{t('onboarding.promptsStep.writeYourOwn')}</Text>
          </TouchableOpacity>

          {/* Available Prompts */}
          {availablePrompts.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.promptOption}
              onPress={() => selectPrompt(prompt)}
            >
              <Text style={[styles.promptOptionText, { color: isDark ? '#D1D5DB' : '#374151' }]}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : showCustomInput ? (
        /* Custom Prompt Input */
        <View>
          <Text style={[styles.customLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('onboarding.promptsStep.customLabel')}
          </Text>
          <TextInput
            style={[styles.customInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.promptsStep.customPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={customPromptText}
            onChangeText={setCustomPromptText}
            multiline
            textAlignVertical="top"
            maxLength={100}
            autoFocus
          />
          <Text style={[styles.charCount, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            {customPromptText.length}/100
          </Text>
          <TouchableOpacity
            style={[styles.usePromptButton, { backgroundColor: customPromptText.trim().length < 10 ? (isDark ? '#2C2C3E' : '#D1D5DB') : '#A08AB7' }]}
            onPress={saveCustomPrompt}
            disabled={customPromptText.trim().length < 10}
          >
            <Text style={styles.usePromptButtonText}>{t('onboarding.promptsStep.useThisPrompt')}</Text>
          </TouchableOpacity>
          <Text style={[styles.minChars, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{t('onboarding.promptsStep.minimumChars')}</Text>
        </View>
      ) : (
        /* Main Prompt View */
        <View>
          {!currentPrompt.prompt ? (
            <TouchableOpacity
              style={[styles.choosePromptButton, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}
              onPress={() => setShowPicker(true)}
            >
              <MaterialCommunityIcons name="plus-circle" size={36} color="#A08AB7" />
              <Text style={[styles.choosePromptText, { color: isDark ? '#D4C4E8' : '#A08AB7' }]}>{t('onboarding.promptsStep.choosePrompt')}</Text>
            </TouchableOpacity>
          ) : (
            <View>
              {/* Selected Prompt Header */}
              <TouchableOpacity
                style={styles.promptHeader}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.promptHeaderText}>{currentPrompt.prompt}</Text>
                <MaterialCommunityIcons name="pencil" size={18} color="white" />
              </TouchableOpacity>

              {/* Answer Input */}
              <View style={styles.answerBox}>
                <TextInput
                  style={[styles.answerInput, { color: isDark ? '#F5F5F7' : '#1A1A2E', borderBottomColor: isDark ? '#2C2C3E' : '#E8E3F0' }]}
                  placeholder={t('onboarding.promptsStep.answerPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={currentPrompt.answer}
                  onChangeText={updateAnswer}
                  multiline
                  textAlignVertical="top"
                  maxLength={200}
                />
                <Text style={[styles.charCount, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
                  {currentPrompt.answer.length}/200
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Tips (only show on first prompt) */}
      {subStep === 0 && !showPicker && !showCustomInput && (
        <View style={[styles.tipsCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}>
          <View style={styles.tipsHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={22} color="#A08AB7" />
            <Text style={[styles.tipsTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.promptsStep.proTips')}</Text>
          </View>
          <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.promptsStep.tip1')}</Text>
          <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.promptsStep.tip2')}</Text>
          <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.promptsStep.tip3')}</Text>
        </View>
      )}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  writeOwnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    marginBottom: 4,
  },
  writeOwnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  promptOption: {
    paddingVertical: 16,
  },
  promptOptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  customLabel: {
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  customInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  usePromptButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  usePromptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  minChars: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  choosePromptButton: {
    alignItems: 'center',
    paddingVertical: 40,
    borderRadius: 24,
  },
  choosePromptText: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#A08AB7',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  promptHeaderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  answerBox: {
    paddingTop: 16,
    paddingHorizontal: 0,
  },
  answerInput: {
    fontSize: 16,
    minHeight: 100,
    lineHeight: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3F0',
    paddingBottom: 12,
  },
  tipsCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tipsTitle: {
    fontWeight: '700',
    fontSize: 17,
  },
  tipItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    paddingLeft: 4,
  },
});
