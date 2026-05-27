import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// PaymentFailedBanner — recovery prompt for users whose auto-renewal
// failed (RevenueCat billing-retry exhausted, status='expired' but
// auto_renew is still true on the subscriptions row). Unlike the
// existing winback flow these users WANTED to keep paying — surfacing
// "your card was declined, tap to update" recovers them with one tap.
// Shown only on Discover, only for failures within the last 30 days,
// after that the message becomes stale noise.

const RECOVERY_WINDOW_DAYS = 30;

export default function PaymentFailedBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;

    (async () => {
      // Query the local subscriptions row. Source of truth for the
      // payment-failed signal is auto_renew=true + status=expired —
      // RevenueCat fired the webhook after exhausting billing retry,
      // but the user never voluntarily cancelled. Profile.is_premium
      // is already false at this point so SubscriptionContext can't
      // distinguish this cohort from voluntary churn.
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

      if (sub.status !== 'expired' || sub.auto_renew !== true) return;
      if (!sub.expires_at) return;

      const expiredAt = new Date(sub.expires_at).getTime();
      const ageDays = (Date.now() - expiredAt) / (1000 * 60 * 60 * 24);
      if (ageDays < 0 || ageDays > RECOVERY_WINDOW_DAYS) return;

      setShouldShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!shouldShow) return null;

  const handlePress = () => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() => {});
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 300 }}
      style={{ marginHorizontal: 16, marginVertical: 8 }}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#DC2626', '#B91C1C']}
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
              <MaterialCommunityIcons name="credit-card-off-outline" size={22} color="white" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                {t('subscription.paymentFailedTitle', 'Your payment was declined')}
              </Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                {t(
                  'subscription.paymentFailedBody',
                  'Your Premium subscription paused because your card was declined. Update payment to resume.'
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
                  {t('subscription.updatePaymentMethod', 'Update Payment')}
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
