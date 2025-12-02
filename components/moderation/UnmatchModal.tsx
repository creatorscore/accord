import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface UnmatchModalProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  matchedProfileId: string;
  matchedProfileName: string;
  currentProfileId: string;
  onUnmatchSuccess?: () => void;
}

export default function UnmatchModal({
  visible,
  onClose,
  matchId,
  matchedProfileId,
  matchedProfileName,
  currentProfileId,
  onUnmatchSuccess,
}: UnmatchModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleUnmatch = async () => {
    setLoading(true);

    try {
      // Call unmatch function
      const { data, error } = await supabase.rpc('unmatch_user', {
        p_match_id: matchId,
        p_unmatcher_profile_id: currentProfileId,
        p_reason: null, // Optional: could add reason selection
      });

      if (error) {
        console.error('Unmatch error:', error);
        throw error;
      }

      // Check if unmatch was successful
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to unmatch');
      }

      console.log('Unmatch successful:', data);

      // Track analytics
      try {
        const { trackEvent } = await import('@/lib/analytics');
        await trackEvent('unmatch_user', {
          match_id: matchId,
          unmatched_profile_id: matchedProfileId,
        });
      } catch (analyticsError) {
        console.error('Analytics error:', analyticsError);
      }

      // Close modal
      onClose();

      // Show success message
      Alert.alert(
        t('unmatch.successTitle', 'Unmatched'),
        t('unmatch.successMessage', `You've unmatched with ${matchedProfileName}`),
        [
          {
            text: t('common.ok', 'OK'),
            onPress: () => {
              // Call success callback (usually navigates back)
              if (onUnmatchSuccess) {
                onUnmatchSuccess();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error unmatching:', error);
      Alert.alert(
        t('common.error', 'Error'),
        error.message || t('unmatch.errorMessage', 'Failed to unmatch. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="heart-broken" size={48} color="#F59E0B" />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {t('unmatch.title', 'Unmatch with {{name}}?', { name: matchedProfileName })}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {t(
              'unmatch.description',
              'This will end your conversation with {{name}}. You may see each other in discovery again.',
              { name: matchedProfileName }
            )}
          </Text>

          {/* Info box */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={20} color="#6B7280" />
            <Text style={styles.infoText}>
              {t(
                'unmatch.privacy',
                '{{name}} won\'t be notified that you unmatched',
                { name: matchedProfileName }
              )}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>
                {t('common.cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.unmatchButton]}
              onPress={handleUnmatch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.unmatchButtonText}>
                  {t('unmatch.button', 'Unmatch')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Alternative: Block instead */}
          <TouchableOpacity style={styles.alternativeAction} onPress={onClose}>
            <Text style={styles.alternativeText}>
              {t('unmatch.needToBlock', 'Need to block instead?')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  unmatchButton: {
    backgroundColor: '#F59E0B',
  },
  unmatchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  alternativeAction: {
    paddingVertical: 8,
  },
  alternativeText: {
    fontSize: 13,
    color: '#A08AB7',
    textDecorationLine: 'underline',
  },
});
