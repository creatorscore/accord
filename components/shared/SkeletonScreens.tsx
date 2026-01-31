import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonRect, SkeletonCircle, SkeletonText } from './Skeleton';

const { width } = Dimensions.get('window');

// Row skeleton used by both matches and messages
function ListRowSkeleton({ index }: { index: number }) {
  return (
    <View style={styles.listRow}>
      <SkeletonCircle size={56} />
      <View style={styles.listRowText}>
        <SkeletonRect width={120 + (index % 3) * 30} height={14} borderRadius={7} />
        <SkeletonRect width={180 + (index % 2) * 40} height={12} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <SkeletonRect width={36} height={12} borderRadius={6} />
    </View>
  );
}

export function MatchesListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ListRowSkeleton key={i} index={i} />
      ))}
    </View>
  );
}

export function MessagesListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ListRowSkeleton key={i} index={i} />
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.profileContainer, { paddingTop: insets.top + 16 }]}>
      {/* Name + header */}
      <View style={styles.profileHeader}>
        <SkeletonRect width={180} height={28} borderRadius={14} />
        <SkeletonCircle size={32} />
      </View>
      <SkeletonRect width={100} height={12} borderRadius={6} style={{ marginTop: 4, marginBottom: 16 }} />

      {/* First photo */}
      <SkeletonRect width="100%" height={width * 1.1} borderRadius={16} />

      {/* Bio section */}
      <View style={{ marginTop: 16 }}>
        <SkeletonRect width={140} height={18} borderRadius={9} style={{ marginBottom: 12 }} />
        <SkeletonText lines={3} lineHeight={14} lastLineWidth="70%" />
      </View>

      {/* Vitals pills */}
      <View style={styles.pillsRow}>
        <SkeletonRect width={60} height={32} borderRadius={16} />
        <SkeletonRect width={80} height={32} borderRadius={16} />
        <SkeletonRect width={100} height={32} borderRadius={16} />
        <SkeletonRect width={70} height={32} borderRadius={16} />
      </View>

      {/* Prompt card */}
      <View style={styles.promptSkeleton}>
        <SkeletonRect width={200} height={12} borderRadius={6} />
        <SkeletonRect width="90%" height={20} borderRadius={10} style={{ marginTop: 16 }} />
        <SkeletonRect width="60%" height={20} borderRadius={10} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

function ChatBubbleSkeleton({ isOwn, widthPct }: { isOwn: boolean; widthPct: number }) {
  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      <SkeletonRect
        width={width * (widthPct / 100)}
        height={40}
        borderRadius={18}
      />
    </View>
  );
}

export function ChatSkeleton() {
  const bubbles = [
    { isOwn: false, widthPct: 55 },
    { isOwn: false, widthPct: 35 },
    { isOwn: true, widthPct: 45 },
    { isOwn: false, widthPct: 60 },
    { isOwn: true, widthPct: 50 },
    { isOwn: true, widthPct: 30 },
    { isOwn: false, widthPct: 40 },
    { isOwn: true, widthPct: 55 },
  ];

  return (
    <View style={styles.chatContainer}>
      {bubbles.map((b, i) => (
        <ChatBubbleSkeleton key={i} isOwn={b.isOwn} widthPct={b.widthPct} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  listRowText: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  promptSkeleton: {
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  bubbleRow: {
    alignItems: 'flex-start',
  },
  bubbleRowOwn: {
    alignItems: 'flex-end',
  },
});
