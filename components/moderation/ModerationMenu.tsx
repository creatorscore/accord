import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportUserModal from './ReportUserModal';
import BlockUserModal from './BlockUserModal';
import UnmatchModal from './UnmatchModal';

interface ModerationMenuProps {
  profileId: string;
  profileName: string;
  matchId?: string;
  currentProfileId?: string;
  onBlock?: () => void;
  onUnmatch?: () => void;
}

export default function ModerationMenu({
  profileId,
  profileName,
  matchId,
  currentProfileId,
  onBlock,
  onUnmatch,
}: ModerationMenuProps) {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [unmatchModalVisible, setUnmatchModalVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleReport = () => {
    closeMenu();
    setTimeout(() => {
      setReportModalVisible(true);
    }, 100);
  };

  const handleUnmatch = () => {
    closeMenu();
    setTimeout(() => {
      setUnmatchModalVisible(true);
    }, 100);
  };

  const handleBlock = () => {
    closeMenu();
    setTimeout(() => {
      setBlockModalVisible(true);
    }, 100);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={openMenu}
        style={styles.menuButton}
      >
        <MaterialCommunityIcons name="dots-vertical" size={24} color="#6B7280" />
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeMenu}
        >
          <Pressable style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                {profileName}
              </Text>
              <Pressable onPress={closeMenu}>
                <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleReport}
              >
                <MaterialCommunityIcons name="flag" size={24} color="#6B7280" />
                <Text style={styles.actionText}>Report User</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              {/* Unmatch option - only show if we have matchId */}
              {matchId && currentProfileId && (
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemWarning]}
                  onPress={handleUnmatch}
                >
                  <MaterialCommunityIcons name="heart-broken" size={24} color="#F59E0B" />
                  <Text style={[styles.actionText, styles.actionTextWarning]}>Unmatch</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#F59E0B" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={handleBlock}
              >
                <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>Block User</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ReportUserModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportedProfileId={profileId}
        reportedProfileName={profileName}
      />

      <UnmatchModal
        visible={unmatchModalVisible}
        onClose={() => setUnmatchModalVisible(false)}
        matchId={matchId || ''}
        matchedProfileId={profileId}
        matchedProfileName={profileName}
        currentProfileId={currentProfileId || ''}
        onUnmatchSuccess={onUnmatch}
      />

      <BlockUserModal
        visible={blockModalVisible}
        onClose={() => setBlockModalVisible(false)}
        blockedProfileId={profileId}
        blockedProfileName={profileName}
        onBlockSuccess={onBlock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  actionsList: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionItemWarning: {
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    marginTop: 8,
  },
  actionItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    marginTop: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  actionTextWarning: {
    color: '#F59E0B',
  },
  actionTextDanger: {
    color: '#EF4444',
  },
});
