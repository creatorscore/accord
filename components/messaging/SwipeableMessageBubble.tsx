import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface SwipeableMessageBubbleProps {
  children: React.ReactNode;
  onReply: () => void;
}

function ReplyAction(prog: SharedValue<number>) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(prog.value, [0, 0.3, 1], [0, 0.5, 1]);
    const scale = interpolate(prog.value, [0, 0.3, 1], [0.5, 0.8, 1]);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.View style={[styles.replyAction, animatedStyle]}>
      <MaterialCommunityIcons name="reply" size={22} color="#A08AB7" />
    </Animated.View>
  );
}

function SwipeableMessageBubble({ children, onReply }: SwipeableMessageBubbleProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const renderLeftActions = useCallback(
    (prog: SharedValue<number>, drag: SharedValue<number>) => {
      return ReplyAction(prog);
    },
    [],
  );

  const handleSwipeOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply();
    // Auto-close after triggering
    setTimeout(() => {
      swipeableRef.current?.close();
    }, 100);
  }, [onReply]);

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      onSwipeableWillOpen={handleSwipeOpen}
      containerStyle={styles.container}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

export default React.memo(SwipeableMessageBubble);

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  replyAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    paddingLeft: 8,
  },
});
