import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// PremiumExpiringBanner — reactivation prompt for users who turned off
// auto-renew but are still inside their paid period. Distinguishes this
// "I cancelled, about to lapse" cohort from voluntary expirations
// (handled by the existing winback flow once status=expired) and from
// payment-failed users (handled by PaymentFailedBanner, which targets
// auto_renew=true + status=expired). Snapshot 2026-05-28: 49 users in
// this state; 14 expire the week of June 1.
//
// Shown only on Discover, only when the user is INSIDE the 14-day
// window before expires_at, so we don't pester users 60 days before
// their period ends. Amber styling instead of red — they made an
// intentional choice, we're nudging, not alarming.

const WINDOW_DAYS = 14;

export default function PremiumExpiringBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;

    (async () => {
      // Same indirection as PaymentFailedBanner — SubscriptionContext
      // collapses this cohort to is_premium=true (because they ARE
      // premium right now) so we can't distinguish them via context.
      // Source of truth is the auto_renew=false flag on the
      // subscriptions row.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.id || cancelled) return;

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, auto_renew, expires_at')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (cancelled || !sub) return;

      if (sub.status !== 'active' || sub.auto_renew !== false) return;
      if (!sub.expires_at) return;

      const expiresAt = new Date(sub.expires_at).getTime();
      const msRemaining = expiresAt - Date.now();
      const days = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      if (days < 0 || days > WINDOW_DAYS) return;

      setDaysRemaining(days);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (daysRemaining === null) return null;

  const handlePress = () => {
    // Direct to the platform subscription page — re-enabling auto-renew
    // happens at the OS level, not in-app. Apple/Google don't allow
    // toggling auto-renew via in-app calls for an already-cancelled
    // subscription; the user has to do it in their account settings.
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() => {});
  };

  // Day-count specific copy because "ends in 0 days" should read
  // "ends today" — small but the urgency message hits differently.
  const title = daysRemaining === 0
    ? t('subscription.expiringToday', 'Your Premium ends today')
    : daysRemaining === 1
      ? t('subscription.expiringTomorrow', 'Your Premium ends tomorrow')
      : t('subscription.expiringInDays', `Your Premium ends in ${daysRemaining} days`, { count: daysRemaining });

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 300 }}
      style={{ marginHorizontal: 16, marginVertical: 8 }}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 16, padding: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialCommunityIcons name="clock-alert-outline" size={22} color="white" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{title}</Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                {t(
                  'subscription.expiringBody',
                  'Auto-renew is off. Tap to keep your Premium features going.'
                )}
              </Text>

              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginTop: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  {t('subscription.keepPremium', 'Keep Premium')}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="rgba(255, 255, 255, 0.8)"
              style={{ marginTop: 8 }}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}
