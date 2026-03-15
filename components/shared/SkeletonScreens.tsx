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

function ChatBubbleSkeleton({ isOwn, widthPct, lines = 1 }: { isOwn: boolean; widthPct: number; lines?: number }) {
  const bubbleHeight = 20 + lines * 18;
  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      <SkeletonRect
        width={width * (widthPct / 100)}
        height={bubbleHeight}
        borderRadius={18}
      />
    </View>
  );
}

export function ChatSkeleton() {
  const insets = useSafeAreaInsets();
  const bubbles = [
    { isOwn: false, widthPct: 55, lines: 2 },
    { isOwn: true, widthPct: 45, lines: 1 },
    { isOwn: false, widthPct: 35, lines: 1 },
    { isOwn: true, widthPct: 60, lines: 2 },
    { isOwn: false, widthPct: 50, lines: 1 },
    { isOwn: true, widthPct: 30, lines: 1 },
    { isOwn: false, widthPct: 40, lines: 2 },
    { isOwn: true, widthPct: 55, lines: 1 },
  ];

  return (
    <View style={styles.chatSkeletonContainer}>
      {/* Header skeleton */}
      <View style={[styles.chatHeaderSkeleton, { paddingTop: insets.top + 8 }]}>
        <SkeletonCircle size={28} />
        <SkeletonCircle size={40} />
        <View style={{ flex: 1 }}>
          <SkeletonRect width={120} height={14} borderRadius={7} />
          <SkeletonRect width={80} height={10} borderRadius={5} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Message bubbles pushed to bottom */}
      <View style={styles.chatBubblesContainer}>
        {bubbles.map((b, i) => (
          <ChatBubbleSkeleton key={i} isOwn={b.isOwn} widthPct={b.widthPct} lines={b.lines} />
        ))}
      </View>

      {/* Input bar skeleton */}
      <View style={[styles.chatInputSkeleton, { paddingBottom: insets.bottom + 8 }]}>
        <SkeletonCircle size={40} />
        <SkeletonCircle size={40} />
        <SkeletonRect width={0} height={40} borderRadius={20} style={{ flex: 1 }} />
        <SkeletonCircle size={40} />
      </View>
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
  chatSkeletonContainer: {
    flex: 1,
  },
  chatHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  chatBubblesContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 10,
  },
  chatInputSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bubbleRow: {
    alignItems: 'flex-start',
  },
  bubbleRowOwn: {
    alignItems: 'flex-end',
  },
});
