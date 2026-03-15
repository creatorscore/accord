import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useProfileData } from './ProfileDataContext';
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListener,
  removePushToken,
  ensurePushTokenSaved,
  addPushTokenChangeListener,
  deobfuscateId,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useToast } from './ToastContext';
import { useMatch } from './MatchContext';

interface NotificationContextType {
  pushToken: string | null;
  notificationsEnabled: boolean;
  unreadMessageCount: number;
  unreadLikeCount: number;
  refreshUnreadCount: () => Promise<void>;
  refreshUnreadLikeCount: () => Promise<void>;
  setUnreadLikeCount: (count: number) => void;
  retryPushTokenRegistration: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  notificationsEnabled: false,
  unreadMessageCount: 0,
  unreadLikeCount: 0,
  refreshUnreadCount: async () => {},
  refreshUnreadLikeCount: async () => {},
  setUnreadLikeCount: () => {},
  retryPushTokenRegistration: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // PERFORMANCE: Use centralized profile data instead of making duplicate queries
  const { profileId } = useProfileData();
  const { showToast, showMessageToast, showLikeToast, showReactionToast } = useToast();
  const { showMatchCelebration } = useMatch();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadLikeCount, setUnreadLikeCount] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const pushTokenListener = useRef<Notifications.Subscription | undefined>(undefined);
  const pendingNavigation = useRef<any>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const retryCount = useRef<number>(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRetries = 10; // Will retry up to 10 times with exponential backoff
  const permissionCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const lastPermissionCheck = useRef<number>(0);

  // Keep pathname ref up to date for use in async callbacks
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // PERFORMANCE: profileId is now provided by ProfileDataContext
  // This eliminates a duplicate database query at startup

  // Fetch unread message count
  const refreshUnreadCount = async () => {
    if (!profileId) return;

    try {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_profile_id', profileId)
        .is('read_at', null);

      if (!error && count !== null) {
        setUnreadMessageCount(count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Fetch unread like count (excluding matched, passed, blocked, and banned profiles)
  // Uses server-side RPC — secure (free users get count without seeing WHO liked them)
  // Also much faster than the previous 6-query client-side approach
  const refreshUnreadLikeCount = async () => {
    if (!profileId) return;

    try {
      const { data: count, error } = await supabase.rpc('count_unmatched_received_likes');

      if (error) {
        console.error('Error fetching unread like count:', error);
        return;
      }

      setUnreadLikeCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread like count:', error);
    }
  };

  // Fetch unread count when profile is available
  // PERFORMANCE: Defer realtime subscriptions to improve cold-start time
  // WebSocket connections add 100-200ms on cold start
  useEffect(() => {
    if (profileId) {
      // PERFORMANCE: Defer unread count fetches to not block UI
      const fetchTimeoutId = setTimeout(() => {
        refreshUnreadCount();
        refreshUnreadLikeCount();
      }, 500);

      // PERFORMANCE: Defer realtime subscriptions even more (not critical for first render)
      let messagesChannel: any = null;
      let likesChannel: any = null;
      let matchesChannel: any = null;

      const subscriptionTimeoutId = setTimeout(() => {
        // Subscribe to new messages in real-time
        messagesChannel = supabase
          .channel('unread-messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `receiver_profile_id=eq.${profileId}`,
            },
            async (payload: any) => {
              // Refresh count when messages change
              refreshUnreadCount();

              // Show in-app toast for new messages (if not in the chat with this match)
              const newMessage = payload.new;
              if (newMessage && newMessage.sender_profile_id && newMessage.match_id) {
                // Skip toast if user is already viewing this chat
                const currentPath = pathnameRef.current;
                if (currentPath === `/chat/${newMessage.match_id}`) {
                  return;
                }

                try {
                  // Get sender's name
                  const { data: sender } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', newMessage.sender_profile_id)
                    .single();

                  if (sender?.display_name) {
                    // Determine message preview based on content type
                    let preview = 'Sent you a message';
                    if (newMessage.content_type === 'image') {
                      preview = '📷 Sent a photo';
                    } else if (newMessage.content_type === 'voice') {
                      preview = '🎤 Sent a voice message';
                    }

                    // Show the toast
                    showMessageToast(sender.display_name, preview, newMessage.match_id);
                  }
                } catch (error) {
                  console.error('Error showing message toast:', error);
                }
              }
            }
          )
          .subscribe();

        // Subscribe to new likes in real-time
        likesChannel = supabase
          .channel('unread-likes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'likes',
              filter: `liked_profile_id=eq.${profileId}`,
            },
            async (payload: any) => {
              // Refresh count when likes change
              refreshUnreadLikeCount();

              // Show in-app toast for new likes
              const newLike = payload.new;
              if (newLike && newLike.liker_profile_id) {
                try {
                  // Get current user's premium status
                  const { data: currentProfile } = await supabase
                    .from('profiles')
                    .select('is_premium, is_platinum')
                    .eq('id', profileId)
                    .single();

                  const isPremium = currentProfile?.is_premium || currentProfile?.is_platinum;

                  if (isPremium) {
                    // Premium users see who liked them
                    const { data: liker } = await supabase
                      .from('profiles')
                      .select('display_name')
                      .eq('id', newLike.liker_profile_id)
                      .single();

                    if (liker?.display_name) {
                      showLikeToast(liker.display_name, true);
                    }
                  } else {
                    // Free users get teaser
                    showLikeToast('Someone', false);
                  }
                } catch (error) {
                  console.error('Error showing like toast:', error);
                }
              }
            }
          )
          .subscribe();

        // Subscribe to new matches in real-time
        matchesChannel = supabase
          .channel('new-matches')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'matches',
              filter: `profile1_id=eq.${profileId}`,
            },
            async (payload: any) => {
              // Show match toast (the full celebration is shown in discover screen)
              const newMatch = payload.new;
              if (newMatch) {
                const otherProfileId = newMatch.profile1_id === profileId
                  ? newMatch.profile2_id
                  : newMatch.profile1_id;

                try {
                  const { data: otherProfile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', otherProfileId)
                    .single();

                  if (otherProfile?.display_name) {
                    showToast({
                      type: 'match',
                      title: "It's a Match! 💜",
                      message: `You matched with ${otherProfile.display_name}!`,
                      onPress: () => router.push('/(tabs)/matches'),
                    });
                  }
                } catch (error) {
                  console.error('Error showing match toast:', error);
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'matches',
              filter: `profile2_id=eq.${profileId}`,
            },
            async (payload: any) => {
              // Show match toast for profile2 matches too
              const newMatch = payload.new;
              if (newMatch) {
                const otherProfileId = newMatch.profile1_id === profileId
                  ? newMatch.profile2_id
                  : newMatch.profile1_id;

                try {
                  const { data: otherProfile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', otherProfileId)
                    .single();

                  if (otherProfile?.display_name) {
                    showToast({
                      type: 'match',
                      title: "It's a Match! 💜",
                      message: `You matched with ${otherProfile.display_name}!`,
                      onPress: () => router.push('/(tabs)/matches'),
                    });
                  }
                } catch (error) {
                  console.error('Error showing match toast:', error);
                }
              }
            }
          )
          .subscribe();

      }, 2000); // 2 second delay for realtime subscriptions

      return () => {
        clearTimeout(fetchTimeoutId);
        clearTimeout(subscriptionTimeoutId);
        if (messagesChannel) supabase.removeChannel(messagesChannel);
        if (likesChannel) supabase.removeChannel(likesChannel);
        if (matchesChannel) supabase.removeChannel(matchesChannel);
      };
    }
  }, [profileId]);

  // PERFORMANCE: Defer push notification initialization to improve cold-start time
  // Push notification registration can add 100-300ms on cold start
  useEffect(() => {
    if (user) {
      // PERFORMANCE: Defer push notification registration until after first render
      // This is not critical for initial app display
      const timeoutId = setTimeout(() => {
        initializePushNotifications();
      }, 1000); // 1 second delay to let UI render first

      return () => {
        clearTimeout(timeoutId);
        // Cleanup listeners
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
        // Cleanup push token listener (critical for token rotation)
        if (pushTokenListener.current) {
          pushTokenListener.current.remove();
        }
        // Stop permission monitoring on cleanup
        if (permissionCheckInterval.current) {
          clearInterval(permissionCheckInterval.current);
          permissionCheckInterval.current = null;
        }
        // Cancel any pending retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      };
    } else {
      // Clean up when user logs out (no need to remove token as user is null)
      setPushToken(null);
      setNotificationsEnabled(false);
      setPermissionStatus(null);
      // Stop permission monitoring
      if (permissionCheckInterval.current) {
        clearInterval(permissionCheckInterval.current);
        permissionCheckInterval.current = null;
      }
    }
  }, [user]);

  const initializePushNotifications = async () => {
    try {
      // Clear badge count on app launch
      try {
        await Notifications.setBadgeCountAsync(0);
      } catch (e) {
        // Ignore badge errors
      }

      // Check current permission status BEFORE registering
      // This helps us track users who denied permissions
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
      } catch (e) {
        console.warn('[Push] Could not check permission status:', e);
      }

      // Register and get push token
      const token = await registerForPushNotifications();

      if (token && user?.id) {
        setPushToken(token);
        setNotificationsEnabled(true);
        setPermissionStatus('granted');

        // Save token to database
        // Note: This may fail for new users during onboarding (no profile yet)
        // The token will be saved again at onboarding completion
        await savePushToken(user.id, token);

        // Set up notification listeners
        setupListeners();
      } else if (!token) {
        // Token not obtained - either permissions denied or device not supported
        // Start periodic permission check for users who may enable later in settings
        startPermissionMonitoring();
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  // Start monitoring for permission changes
  // This catches users who initially denied but later enable in system settings
  const startPermissionMonitoring = useCallback(() => {
    // Only start if we don't already have a token and interval isn't running
    if (pushToken || permissionCheckInterval.current) {
      return;
    }

    // Check every 30 seconds while app is in foreground
    permissionCheckInterval.current = setInterval(async () => {
      // Skip if we already have a token
      if (pushToken) {
        stopPermissionMonitoring();
        return;
      }

      // Skip if not logged in
      if (!user?.id) {
        return;
      }

      // Throttle checks - no more than once per 30 seconds
      const now = Date.now();
      if (now - lastPermissionCheck.current < 30000) {
        return;
      }
      lastPermissionCheck.current = now;

      try {
        const { status } = await Notifications.getPermissionsAsync();

        // If permission was denied before but now granted, register!
        if (status === 'granted' && permissionStatus !== 'granted') {
          setPermissionStatus('granted');

          const token = await registerForPushNotifications();
          if (token && user?.id) {
            setPushToken(token);
            setNotificationsEnabled(true);
            await savePushToken(user.id, token);
            setupListeners();
            stopPermissionMonitoring();
          }
        } else if (status !== permissionStatus) {
          setPermissionStatus(status);
        }
      } catch (error) {
        console.warn('[Push] Error checking permissions:', error);
      }
    }, 30000); // Check every 30 seconds
  }, [pushToken, user?.id, permissionStatus]);

  const stopPermissionMonitoring = useCallback(() => {
    if (permissionCheckInterval.current) {
      clearInterval(permissionCheckInterval.current);
      permissionCheckInterval.current = null;
    }
  }, []);

  // Manual retry function - can be called from settings or profile screen
  const retryPushTokenRegistration = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      // First check if permissions are now granted
      const { status } = await Notifications.getPermissionsAsync();

      if (status !== 'granted') {
        // Request permissions again
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          setPermissionStatus(newStatus);
          return;
        }
      }

      setPermissionStatus('granted');

      // Try to get token
      const token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);
        setNotificationsEnabled(true);
        await savePushToken(user.id, token);

        // Also ensure it's saved with retry mechanism
        retryCount.current = 0;
        await ensurePushTokenSaved(user.id, token);

        setupListeners();
        stopPermissionMonitoring();
      }
    } catch (error) {
      console.error('[Push] Error on manual retry:', error);
    }
  }, [user?.id, stopPermissionMonitoring]);

  // Aggressive retry mechanism with exponential backoff
  // This ensures push tokens are ALWAYS saved, even if profile creation is delayed
  const retrySavePushToken = async () => {
    if (!user?.id || !pushToken) return;
    if (retryCount.current >= maxRetries) {
      console.warn('⚠️  Max retries reached for push token save');
      return;
    }

    try {
      const success = await ensurePushTokenSaved(user.id, pushToken);
      if (success) {
        retryCount.current = 0; // Reset on success
        retryTimeoutRef.current = null;
      } else {
        // Token not saved yet, schedule another retry
        retryCount.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 60000); // Exponential backoff, max 60s
        retryTimeoutRef.current = setTimeout(retrySavePushToken, delay);
      }
    } catch (error) {
      console.error('❌ Error in retry push token:', error);
      // Still retry on error
      retryCount.current++;
      if (retryCount.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 60000);
        retryTimeoutRef.current = setTimeout(retrySavePushToken, delay);
      }
    }
  };

  // Retry saving push token when app comes to foreground
  // This catches users who completed onboarding while app was in background
  // AND users who initially denied permissions but later enabled them in settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Clear badge count when app is opened
        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (error) {
          console.warn('Failed to clear badge:', error);
        }

        // ALWAYS try to get and save token on foreground if user is logged in
        // This catches users who:
        // 1. Initially denied permissions but later enabled in settings
        // 2. Had token obtained but profile wasn't created yet
        // 3. Had any other timing issue during onboarding
        if (user?.id) {
          try {
            // First, check current permission status
            // This is critical for catching users who enabled permissions in system settings
            const { status: currentStatus } = await Notifications.getPermissionsAsync();

            // If we don't have a token but permissions are now granted, register!
            if (!pushToken && currentStatus === 'granted') {
              const newToken = await registerForPushNotifications();
              if (newToken) {
                setPushToken(newToken);
                setNotificationsEnabled(true);
                setPermissionStatus('granted');
                await savePushToken(user.id, newToken);
                setupListeners();
                stopPermissionMonitoring();
              }
            } else if (!pushToken && currentStatus !== 'granted') {
              // Still no permissions - update status and keep monitoring
              setPermissionStatus(currentStatus);
              startPermissionMonitoring();
            } else if (pushToken) {
              // We have a token - verify it's saved
              retryCount.current = 0;
              await ensurePushTokenSaved(user.id, pushToken);
            }
          } catch (error) {
            console.warn('Error checking push token on foreground:', error);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, pushToken, startPermissionMonitoring, stopPermissionMonitoring]);

  // Initial retry mechanism - start retrying immediately after token is obtained
  useEffect(() => {
    if (user && pushToken) {
      // Start aggressive retry loop
      retryCount.current = 0;
      retrySavePushToken();
    }
  }, [user, pushToken]);

  const setupListeners = () => {
    // CRITICAL: Listen for push token changes at runtime
    // FCM can rotate tokens silently - when this happens, we MUST update the database
    // Without this, users get DeviceNotRegistered errors and miss all notifications
    pushTokenListener.current = addPushTokenChangeListener(async (newToken: string) => {
      if (user?.id && newToken) {
        try {
          // Update both in-memory state and database
          setPushToken(newToken);
          await savePushToken(user.id, newToken);
        } catch (error) {
          console.error('[Push] ❌ Failed to update token after runtime change:', error);
          // Schedule retry
          retryCount.current = 0;
          setTimeout(() => retrySavePushToken(), 1000);
        }
      }
    });

    // Handle notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';

        // Deobfuscate IDs from push payload
        const fgMatchId = data?.matchId ? deobfuscateId(data.matchId as string) : undefined;

        // Show in-app toast based on notification type
        if (data?.type === 'new_message' && fgMatchId) {
          // Extract sender name from title (format: "New message from Name")
          const senderName = title.replace('New message from ', '');
          showMessageToast(senderName, body, fgMatchId);
        } else if (data?.type === 'message_reaction' && fgMatchId) {
          // Extract reactor name and emoji from title (format: "Name reacted emoji")
          const match = title.match(/^(.+) reacted (.+)$/);
          if (match) {
            const reactorName = match[1];
            const emoji = match[2];
            showReactionToast(reactorName, emoji, fgMatchId);
          }
        } else if (data?.type === 'new_like') {
          const isPremium = data?.isPremium === true;
          const likerName = isPremium && title ? title.replace(' likes you!', '') : 'Someone';
          showLikeToast(likerName, isPremium);
        } else if (data?.type === 'new_match' && fgMatchId) {
          // For matches, show a toast (the full celebration modal is shown from discover screen)
          showToast({
            type: 'match',
            title: title || "It's a Match!",
            message: body || 'You have a new match!',
            onPress: () => router.push('/(tabs)/matches'),
          });
        } else if (title || body) {
          // Generic notification toast
          showToast({
            type: 'info',
            title: title || 'Notification',
            message: body,
          });
        }
      }
    );

    // Handle notification tap
    responseListener.current = setupNotificationListener((data) => {
      handleNotificationResponse(data);
    });
  };

  const handleNotificationResponse = async (data: any) => {
    if (!data || !data.type) return;

    // Deobfuscate IDs from push payload (backward-compatible with old payloads)
    const matchId = data.matchId ? deobfuscateId(data.matchId) : undefined;
    const likerProfileId = data.likerProfileId ? deobfuscateId(data.likerProfileId) : undefined;

    // Store the navigation data for the app to handle
    // Navigation will be handled by individual screens using useEffect
    // to check for pending notifications after mounting
    pendingNavigation.current = { ...data, matchId, likerProfileId };

    // Handle navigation based on notification type
    try {
      switch (data.type) {
        case 'review_ready':
        case 'review_reminder':
          // Navigate to reviews screen
          router.push('/reviews/my-reviews');
          break;
        case 'new_match':
          // Navigate to matches tab
          router.push('/(tabs)/matches');
          break;
        case 'new_message':
        case 'message_reaction':
          // Navigate to chat if matchId is available
          if (matchId) {
            router.push(`/chat/${matchId}`);
          } else {
            router.push('/(tabs)/messages');
          }
          break;
        case 'new_like':
          // For premium users, check if the liker has become a match
          // (happens when user swiped right on them from Discover before tapping notification)
          // PERFORMANCE: Use profileId from ProfileDataContext instead of querying
          if (likerProfileId && profileId) {
            try {
              // Check if there's already a match with this liker
              const profile1Id = profileId < likerProfileId ? profileId : likerProfileId;
              const profile2Id = profileId < likerProfileId ? likerProfileId : profileId;

              const { data: existingMatch } = await supabase
                .from('matches')
                .select('id')
                .eq('profile1_id', profile1Id)
                .eq('profile2_id', profile2Id)
                .eq('status', 'active')
                .maybeSingle();

              if (existingMatch) {
                // The like has become a match! Redirect to matches instead
                router.push('/(tabs)/matches');
                return;
              }
            } catch (error) {
              console.error('Error checking if like is now a match:', error);
              // Fall through to default likes navigation
            }
          }
          // Navigate to likes tab (default behavior)
          router.push('/(tabs)/likes');
          break;
        default:
          // For unknown types, store for screens to handle
          break;
      }
    } catch (error) {
      console.error('Error navigating from notification:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        pushToken,
        notificationsEnabled,
        unreadMessageCount,
        unreadLikeCount,
        refreshUnreadCount,
        refreshUnreadLikeCount,
        setUnreadLikeCount,
        retryPushTokenRegistration,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
