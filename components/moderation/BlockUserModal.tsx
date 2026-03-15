import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface BlockUserModalProps {
  visible: boolean;
  onClose: () => void;
  blockedProfileId: string;
  blockedProfileName: string;
  onBlockSuccess?: () => void;
}

export default function BlockUserModal({
  visible,
  onClose,
  blockedProfileId,
  blockedProfileName,
  onBlockSuccess,
}: BlockUserModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('moderation.block.mustBeLoggedIn'));
      return;
    }

    setLoading(true);

    try {
      // Get blocker's profile ID
      const { data: blockerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Block the user
      // Note: A database trigger automatically handles:
      // 1. Deleting all messages between users (prevents screenshot blackmail)
      // 2. Deleting the match record (removes from both users' match lists)
      const { error: blockError } = await supabase
        .from('blocks')
        .insert({
          blocker_profile_id: blockerProfile.id,
          blocked_profile_id: blockedProfileId,
        });

      if (blockError) {
        // Check if already blocked
        if (blockError.code === '23505') {
          Alert.alert(t('moderation.block.alreadyBlocked'), t('moderation.block.alreadyBlockedMessage'));
          onClose();
          return;
        }
        throw blockError;
      }

      Alert.alert(
        t('moderation.block.userBlocked'),
        t('moderation.block.userBlockedMessage', { name: blockedProfileName }),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              onClose();
              onBlockSuccess?.();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error blocking user:', error);
      Alert.alert(t('common.error'), t('moderation.block.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="cancel" size={64} color="#EF4444" />
          </View>

          {/* Title */}
          <Text style={styles.title}>{t('moderation.block.title', { name: blockedProfileName })}</Text>

          {/* Description */}
          <Text style={styles.description}>
            {t('moderation.block.description')}
          </Text>

          <View style={styles.bulletPoints}>
            <View style={styles.bulletPoint}>
              <MaterialCommunityIcons name="check" size={20} color="#6B7280" />
              <Text style={styles.bulletText}>
                {t('moderation.block.hideProfile')}
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <MaterialCommunityIcons name="check" size={20} color="#6B7280" />
              <Text style={styles.bulletText}>
                {t('moderation.block.preventMessages')}
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <MaterialCommunityIcons name="check" size={20} color="#EF4444" />
              <Text style={[styles.bulletText, { color: '#EF4444', fontWeight: '600' }]}>
                {t('moderation.block.deleteMessages')}
              </Text>
            </View>
            <View style={styles.bulletPoint}>
              <MaterialCommunityIcons name="check" size={20} color="#6B7280" />
              <Text style={styles.bulletText}>
                {t('moderation.block.noNotification')}
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            {t('moderation.block.unblockNote')}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.blockButton, loading && styles.blockButtonDisabled]}
              onPress={handleBlock}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.blockButtonText}>{t('moderation.block.blockUser')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  bulletPoints: {
    width: '100%',
    marginBottom: 16,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 8,
  },
  bulletText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  note: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  blockButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  blockButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  blockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
