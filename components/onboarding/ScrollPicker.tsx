import { useEffect, useCallback, useRef, memo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedRef,
  scrollTo,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const ITEM_HEIGHT = 72;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface ScrollPickerProps {
  items: { label: string; value: number }[];
  selectedValue: number | null;
  onValueChange: (value: number) => void;
}

function triggerHaptic() {
  Haptics.selectionAsync();
}

// ─── Individual animated item ─────────────────────────────────────────────────

const PickerItem = memo(({
  label,
  index,
  scrollY,
  isDark,
}: {
  label: string;
  index: number;
  scrollY: SharedValue<number>;
  isDark: boolean;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = scrollY.value - index * ITEM_HEIGHT;
    const absDistance = Math.abs(distance);

    const scale = interpolate(
      absDistance,
      [0, ITEM_HEIGHT],
      [1, 0.8],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      absDistance,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1, 0.35, 0],
      Extrapolation.CLAMP,
    );

    return { opacity, transform: [{ scale }] };
  });

  return (
    <View style={styles.item}>
      <Animated.Text
        style={[
          styles.itemText,
          { color: isDark ? '#F5F5F7' : '#1A1A2E' },
          animatedStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </View>
  );
});

// ─── ScrollPicker ─────────────────────────────────────────────────────────────

export default function ScrollPicker({
  items,
  selectedValue,
  onValueChange,
}: ScrollPickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const isInitialized = useSharedValue(false);
  const hasInitialized = useRef(false);

  // Scroll to selected value on mount, and when items change (unit switch)
  useEffect(() => {
    if (selectedValue === null) return;
    const index = items.findIndex((item) => item.value === selectedValue);
    if (index < 0) return;

    if (!hasInitialized.current) {
      // First mount — short delay for layout
      setTimeout(() => {
        scrollTo(scrollRef, 0, index * ITEM_HEIGHT, false);
        hasInitialized.current = true;
        isInitialized.value = true;
      }, 150);
    } else {
      // Items changed (unit switch) — jump immediately
      scrollTo(scrollRef, 0, index * ITEM_HEIGHT, false);
    }
  }, [items]);

  // Haptic tick as each item crosses center during scroll
  useAnimatedReaction(
    () => Math.round(scrollY.value / ITEM_HEIGHT),
    (current, previous) => {
      if (previous !== null && current !== previous && isInitialized.value) {
        runOnJS(triggerHaptic)();
      }
    },
  );

  const handleSelect = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      onValueChange(items[clamped].value);
    },
    [items, onValueChange],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      runOnJS(handleSelect)(index);
    },
  });

  return (
    <View style={styles.container}>
      {/* Top selection line */}
      <View
        style={[
          styles.selectionLine,
          { top: ITEM_HEIGHT, backgroundColor: isDark ? '#E5E7EB' : '#1A1A2E' },
        ]}
        pointerEvents="none"
      />
      {/* Bottom selection line */}
      <View
        style={[
          styles.selectionLine,
          { top: ITEM_HEIGHT * 2, backgroundColor: isDark ? '#E5E7EB' : '#1A1A2E' },
        ]}
        pointerEvents="none"
      />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        style={{ height: PICKER_HEIGHT }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
      >
        {items.map((item, index) => (
          <PickerItem
            key={item.value}
            label={item.label}
            index={index}
            scrollY={scrollY}
            isDark={isDark}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: PICKER_HEIGHT,
    position: 'relative',
  },
  selectionLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
});
