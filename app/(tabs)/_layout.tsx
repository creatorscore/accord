import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { useNotifications } from '@/contexts/NotificationContext';
import * as Haptics from 'expo-haptics';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { unreadMessageCount, unreadLikeCount } = useNotifications();

  // Add extra padding for safe area (home indicator on iPhone X+, navigation bar on Android)
  const tabBarHeight = 60 + insets.bottom;
  const paddingBottom = insets.bottom + 5;

  // Hardcoded tab bar icon colors. The tab bar background is always the
  // dark brand color (#0A0A0B) regardless of the user's system theme, so
  // icons need to be white-on-dark always. Relying on the tintColor props
  // alone wasn't reliable on some Android devices — when a user had system
  // dark-mode off, React Navigation's theme was bleeding through and
  // rendering icons in theme.text (near-black), giving black-on-black
  // invisible icons. Passing the color explicitly to every Icon bypasses
  // that code path entirely.
  const ACTIVE_ICON = '#FFFFFF';
  const INACTIVE_ICON = 'rgba(255,255,255,0.6)';

  return (
    <Tabs
      screenListeners={{
        tabPress: () => Haptics.selectionAsync(),
      }}
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: ACTIVE_ICON,
        tabBarInactiveTintColor: INACTIVE_ICON,
        tabBarStyle: {
          backgroundColor: '#0A0A0B',
          borderTopWidth: 0,
          paddingBottom: paddingBottom,
          paddingTop: 5,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ focused }) => (
            <Ionicons name="search" size={22} color={focused ? ACTIVE_ICON : INACTIVE_ICON} />
          ),
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: t('tabs.likes'),
          tabBarIcon: ({ focused }) => (
            <View>
              <FontAwesome5 name="star" size={22} color={focused ? ACTIVE_ICON : INACTIVE_ICON} />
              {unreadLikeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadLikeCount > 99 ? '99+' : unreadLikeCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarIcon: ({ focused }) => (
            <FontAwesome5 name="heart" size={22} color={focused ? ACTIVE_ICON : INACTIVE_ICON} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: ({ focused }) => (
            <View>
              <FontAwesome5 name="comment-alt" size={22} color={focused ? ACTIVE_ICON : INACTIVE_ICON} />
              {unreadMessageCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => (
            <FontAwesome5 name="user" size={22} color={focused ? ACTIVE_ICON : INACTIVE_ICON} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
